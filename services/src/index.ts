import Web3 from "web3";
import util from 'util';
import dotenv from 'dotenv';
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import marketplace from './abi/marketplace';
import MarketplaceSDK from './MarketplaceSDK';
import TokenSDK from './TokenSDK';
import AbiUtils from './AbiUtils';

dotenv.config();

const MAX_UINT48 = 281474976710655;

const blockchain = process.env.BLOCKCHAIN_NAME;

const PUBLIC_SALE = '0';
const PRIVATE_SALE = '1';
const LOCKED_PUBLIC_SALE = '2';
const LOCKED_PRIVATE_SALE = '3';
const SECURE_SEND = '4';
const PUBLIC_SALE_ERC721 = '5';
const PRIVATE_SALE_ERC721 = '6';
const PUBLIC_SALE_ERC1155 = '7';
const PRIVATE_SALE_ERC1155 = '8';
const DONATION = '9';

const SALE_WITH_CLAIM = [
    LOCKED_PUBLIC_SALE,
    LOCKED_PRIVATE_SALE,
    SECURE_SEND
];

const SALE_WITH_WHITELIST = [
    PRIVATE_SALE,
    LOCKED_PRIVATE_SALE,
    SECURE_SEND,
    PRIVATE_SALE_ERC721,
    PRIVATE_SALE_ERC1155
];

const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true, 
};

const clientDB = new DynamoDB({});

const nextClaim = async(sdk:MarketplaceSDK, instance:any, sale:any, account:string, currentPackage:any) => {

    const lastPackage = sale.next_claim.get(account);

    if(SALE_WITH_CLAIM.includes(sale.kind) && (!lastPackage || lastPackage.currentPackage < currentPackage)) {

        const infoPackage = await sdk.infoPackage(instance, sale.kind, sale.identifier, account, currentPackage)
        .catch((e) => { console.log('WARN', e.message) });

        if(infoPackage) {

            return { timestamp: infoPackage.lockedUntil * 1000, currentPackage };
        }
    }

    return null;
}

const infoSale = async(web3:any, sdk:MarketplaceSDK, tokenSDK:TokenSDK, instance:any, saleId:any, kind:any) => {

    const info = await sdk.info(instance, kind, saleId);

    info.tokenBase = info.tokenBase.toLowerCase();
    info.tokenQuote = info.tokenQuote.toLowerCase();
    info.seller = info.seller.toLowerCase();

    const tokenBase = await tokenSDK.infoWithAmount(info.tokenBase, info.amountBase);
    const tokenQuote = await tokenSDK.infoWithAmount(info.tokenQuote, info.amountQuote);

    return {
        identifier: info.saleId,
        seller_wallet: info.seller,
        whitelisted_wallets: new Set<String>(),
        category: 'token',
        blockchain,
        kind: info.kind,
        base_token_name: tokenBase.token.name,
        base_token_address: tokenBase.token.address,
        base_token_symbol: tokenBase.token.symbol,
        base_token_quantity: tokenBase.amount,
        base_token_id: info.tokenBaseId,
        quote_token_name: tokenQuote.token.name,
        quote_token_address: tokenQuote.token.address,
        quote_token_symbol: tokenQuote.token.symbol,
        quote_token_quantity: tokenQuote.amount,
        quote_token_id: info.tokenQuoteId,
        ratio: tokenBase.amount > 0 && tokenQuote.amount > 0 ? tokenBase.amount / tokenQuote.amount : 0,
        purchases: new Map<String,any[]>(),
        claims: new Map<String,any[]>(),
        next_claim: new Map<String,any>(),
        period: info.lockoutPeriod,
        packages: info.numberPackages,
        create_date: info.openingTime * 1000,
        close_date: info.closingTime < MAX_UINT48 ?  info.closingTime * 1000 : 0,
        update_date: info.openingTime * 1000,
    };
}

const getSale = async(saleId:string) => {
    
    const search = {
        TableName: "marketplace",
        Key: marshall({ identifier: saleId, blockchain }, marshallOptions),
    };

    const { Item } = await clientDB.getItem(search);

    if(Item) {
        
        const sale = unmarshall(Item);

        sale.purchases = new Map(Object.entries(sale.purchases));
        sale.claims = new Map(Object.entries(sale.claims));
        sale.next_claim = new Map(Object.entries(sale.next_claim));
        sale.whitelisted_wallets = sale.whitelisted_wallets || new Set<String>();
        
        return sale;
    };

    throw new Error(`SaleId '${saleId}' not found in DynamoDB`);
}

const createSale = async (web3:any, sdk:MarketplaceSDK, tokenSDK:TokenSDK, instance:any, log:any, saleId:string, kind:string) => {

    const sale = await infoSale(web3, sdk, tokenSDK, instance, saleId, kind);

    if(SALE_WITH_WHITELIST.includes(kind)) {

        const receipt = await web3.eth.getTransactionReceipt(log.transactionHash);

        const logs = receipt.logs.filter((log) => log.topics[0] === '0x3e3cf70109cc5c6ab94f276cb1ebbe6767323b99419ba7e87629984f200fef81');
        
        for(const logWhitelisted of logs) {

            const decoded = AbiUtils.decode(web3, logWhitelisted);

            if(decoded) {
    
                const account = decoded.account.toLowerCase();
    
                sale.whitelisted_wallets.add(account);
    
                let infoNextClaim = null;
                
                if(kind === SECURE_SEND) infoNextClaim = await nextClaim(sdk, instance, sale, account, 0);
    
                if(infoNextClaim) sale.next_claim.set(account, infoNextClaim);
            }
        }
    }

    return sale;
}

const buySale = async (web3:any, sdk:MarketplaceSDK, tokenSDK:TokenSDK, instance:any, log:any, saleId:string, kind:string) => {

    const currentSnapshot = await getSale(saleId);

    const sale = {
        identifier: saleId,
        kind,
        blockchain,
        purchases: currentSnapshot.purchases,
        close_date: currentSnapshot.close_date,
        next_claim: currentSnapshot.next_claim
    }

    const decoded = AbiUtils.decode(web3, log);

    if(decoded) {

        const { amountIn, amountOut } = decoded;

        const account = decoded.account.toLowerCase();

        const tokenBase = await tokenSDK.infoWithAmount(currentSnapshot.base_token_address, amountOut);

        const tokenQuote = await tokenSDK.infoWithAmount(currentSnapshot.quote_token_address, amountIn);
        
        let listPurchases = sale.purchases.get(account.toLowerCase());

        listPurchases = listPurchases || [];

        const block = await web3.eth.getBlock(log.blockNumber);

        if(!listPurchases.find((purchases) => purchases.timestamp === block.timestamp * 1000)) {

            listPurchases.push({ 
                timestamp: block.timestamp * 1000, 
                amountIn: tokenQuote.amount,
                amountOut: tokenBase.amount
            });

            sale.purchases.set(account.toLowerCase(), listPurchases);
        }

        sale.close_date = block.timestamp * 1000;

        const infoNextClaim = await nextClaim(sdk, instance, sale, account, 0);

        if(infoNextClaim) sale.next_claim.set(account, infoNextClaim);
    }

    return sale;
}

const cancelSale = async (web3:any, sdk:MarketplaceSDK, tokenSDK:TokenSDK, instance:any, log:any, saleId:string) => {

    const currentSnapshot = await getSale(saleId);

    const sale = {
        identifier: saleId,
        blockchain,
        close_date: currentSnapshot.close_date,
        next_claim: new Map<String,any>()
    }

    const block = await web3.eth.getBlock(log.blockNumber);

    sale.close_date = block.timestamp * 1000;

    return sale;
}

const claimSale = async (web3:any, sdk:MarketplaceSDK, tokenSDK:TokenSDK, instance:any, log:any, saleId:string, kind:string) => {

    const currentSnapshot = await getSale(saleId);

    const sale = {
        identifier: saleId,
        kind,
        blockchain,
        claims: currentSnapshot.claims,
        next_claim: currentSnapshot.next_claim
    }

    const decoded = AbiUtils.decode(web3, log);

    if(decoded) {

        const { numberPackage, amount } = decoded;

        const account = decoded.account.toLowerCase();

        let listClaims = sale.claims.get(account);

        listClaims = listClaims || [];

        const block = await web3.eth.getBlock(log.blockNumber);

        const tokenBase = await tokenSDK.infoWithAmount(currentSnapshot.base_token_address, amount);

        if(!listClaims.find((claim) => claim.timestamp === block.timestamp * 1000)) {

            listClaims.push({ 
                timestamp: block.timestamp * 1000, 
                numberPackage, 
                amount: tokenBase.amount,
            });
    
            sale.claims.set(account, listClaims);
        }

        const currentPackage = Number.parseInt(numberPackage, 10) + 1;

        const infoNextClaim = await nextClaim(sdk, instance, sale, account, currentPackage);

        if(infoNextClaim) sale.next_claim.set(account, infoNextClaim);
        else sale.next_claim.delete(account);
    }

    return sale;
}

const updateDynamoDB = async (table:any, key:any, value:any) => {
    
    let updateExpression = "SET ";
    const expressionAttributeValues = {}

    const valueMarshal = marshall(value, marshallOptions);

    const keys = Object.keys(key);

    Object.keys(value).forEach((entry:any) => {
        if(!keys.includes(entry)) {
            updateExpression = `${updateExpression} ${entry} = :${entry} ,`;
            expressionAttributeValues[`:${entry}`] = valueMarshal[entry];
        }
    })

    updateExpression = updateExpression.substring(0, updateExpression.lastIndexOf(','));

    const params = {
        TableName: table,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues
    };

    await clientDB.updateItem(params);
}

const init = async () => {

    const options = {
        reconnect: {
            auto: true,
            delay: 5000, // ms
            maxAttempts: 5,
            onTimeout: false
        }
    };
    
    const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.NETWORK_RPC, options));

    const tokenSDK = new TokenSDK(web3, process.env.TOKEN_INFO_ADDRESS);

    const sdk = new MarketplaceSDK(web3.currentProvider, tokenSDK.ETH_ADDRESS);

    const contractAddress = process.env.MARKETPLACE_ADDRESS;

    const instance = await sdk.getInstance(contractAddress, marketplace);

    const topicMap = new Map<String, any>();

    topicMap.set('0xba45e1d0695d4b0ce5c726dc020b442d2132a99a8420bbee8963f83976c982e7', createSale);

    topicMap.set('0x09e71473ade13d33e5bbdf6a5cfaba0863081921bc193660db38135998873781', buySale);

    topicMap.set('0xa302f63e60e9c7402c0249054ee1b26355e5fb1e5c0a36896e46990476704df6', cancelSale);

    topicMap.set('0x99ac8e1f015488f2055a68fbdbcab7902c77dc582b8003c020fc5a02916fa19e', claimSale);
    

    await web3.eth.subscribe('logs', { address: contractAddress }, async (error, log)=> {

        if (!error) {

            const snapshotSale = topicMap.get(log.topics[0]);

            if(snapshotSale) {

                try {

                    const saleId = web3.utils.toBN(log.topics[1]).toString();

                    const kind = web3.utils.toBN(log.topics[2]).toString();

                    const sale = await snapshotSale(web3, sdk, tokenSDK, instance, log, saleId, kind);

                    const key = marshall({ identifier: saleId, blockchain }, marshallOptions);

                    console.log(util.inspect(sale, {showHidden: false, depth: null}))

                    await updateDynamoDB('marketplace', key, sale);

                } catch(e) {

                    console.log('ERROR', `Could not process ${log.transactionHash} - ${e.message}`);
                }
            }

        } else {
            console.log('ERROR', error);
            process.exit(-1);
        }
    }).on("error", (error) => {
        console.log('ERROR', error);
        process.exit(-1);
    });

    console.log(`Listener marketplace activated: ${contractAddress}`);
}

init();
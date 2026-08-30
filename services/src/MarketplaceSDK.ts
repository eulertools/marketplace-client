import Web3 from 'web3';

class MarketplaceSDK {

    public provider:any;

    public web3:Web3;

    public ETH:string

    public constructor(provider:any, ETH:string) {

        this.web3 = new Web3(provider);

        this.provider = provider;

        this.ETH = ETH;
    }

    public getInstance = async (contractAddress:string, json:any) =>
        new this.web3.eth.Contract(json, contractAddress)

    public info = async(instance:any, kind:string, saleId:string) => {

        const response = await instance.methods.info(kind, saleId).call();

        return {
            saleId: saleId.toString(),
            kind: kind.toString(),
            amountBase: response.amountBase,
            amountQuote: response.amountQuote,
            openingTime: response.openingTime,
            closingTime: response.closingTime,
            tokenBaseId: response.tokenBaseId,
            tokenQuoteId: response.tokenQuoteId,
            tokenBase: response.tokenBase,
            tokenQuote:  response.tokenQuote,
            seller: response.seller,
            numberPackages: response.numberPackages,
            lockoutPeriod: response.lockoutPeriod,
            amountPending: response.amountPending
        }
    }

    public infoPackage =  async(instance:any, kind:string, saleId:string, account:string, numberPackage:number) => {

        const [lockedUntil, amount, claimed] = await instance.methods.infoPackage(kind, saleId, account, numberPackage).call();

        return {
            lockedUntil,
            amount,
            claimed
        }
    }
}

export default MarketplaceSDK;

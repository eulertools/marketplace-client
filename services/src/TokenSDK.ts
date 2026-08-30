import Web3 from 'web3';
import TOKEN_INFO_JSON from './abi/tokenInfo';

class TokenSDK {

    public web3:Web3;

    private contractAddress:string;

    private instance:any;

    public ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    public NO_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

    public TOKEN_ETH = {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18,
        address: this.ETH_ADDRESS
    };

    public NO_TOKEN = {
        name: null,
        symbol: null,
        decimals: null,
        address: null
    };

    public constructor(web3:any, contractAddress:string) {

        this.web3 = web3;

        this.contractAddress = contractAddress;
    }

    private getInstance = async () => {

        if(!this.instance) {

            const json:any = TOKEN_INFO_JSON;

            this.instance =  new this.web3.eth.Contract(json, this.contractAddress);
        }

        return this.instance;
    }

    public infoWithAmount = async (address:string, amountWei) => {

        let token = this.NO_TOKEN;
        let amount = null;
    
        if(address && address !== this.ETH_ADDRESS && address !== this.NO_TOKEN_ADDRESS) {

            token = await this.info(address);

            amount = amountWei;
            
            if(token.decimals > 0) {
                amount = amountWei / 10 ** token.decimals;
            } 

        } else if(address === this.ETH_ADDRESS) {
            token = this.TOKEN_ETH;
            amount = amountWei / 10 ** 18;
        }
    
        return { token, amount };
    }

    public info = async(address:string) => {

        address = address.toLowerCase();

        const instance = await this.getInstance();

        const token = await instance.methods.generalInfo(address).call();

        const {name, symbol, decimals } = token;

        return { name, address, symbol, decimals};
    }
}

export default TokenSDK;

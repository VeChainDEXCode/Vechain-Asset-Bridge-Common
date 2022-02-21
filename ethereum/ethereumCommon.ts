import Web3 from "web3";
import { ActionData } from "../utils/components/actionResult";
import { sleep } from "../utils/sleep";
import { BlockIndex } from "../utils/types/blockIndex";

export class EthereumCommon {
    constructor(env:any){
        this.env = env;
        this.config = env.config;
        this.web3 = env.web3;
    }

    public async checkTxStatus(txhash:string,blockRef:number):Promise<ActionData<"reverted"|"confirmed"|"expired"|"pending">>{
        let result = new ActionData<"reverted"|"confirmed"|"expired"|"pending">();
        const bestBlock = await this.web3.eth.getBlockNumber();

        try {
            const receipt = await this.web3.eth.getTransactionReceipt(txhash);
            if(receipt != null && bestBlock - blockRef > this.config.ethereum.confirmHeight){
                if(receipt.status == false){
                    result.data = "reverted";
                } else {
                    result.data = "confirmed";
                }
            } else if(bestBlock - blockRef > this.config.ethereum.expiration) {
                result.data = "expired";
            } else {
                console.debug(`Ethereum Tx: ${txhash} pending ${bestBlock - blockRef}/${this.config.ethereum.confirmHeight}`);
                result.data = "pending";
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async confirmTx(txhash:string):Promise<ActionData<"reverted"|"confirmed"|"expired">>{
        let result = new ActionData<"reverted"|"confirmed"|"expired">();
        const blockRef = await this.web3.eth.getBlockNumber();
        while(true){
            const bestBlock = await this.web3.eth.getBlockNumber();
            try {
                const receipt = await this.web3.eth.getTransactionReceipt(txhash);
                if(receipt != null){
                    if(receipt.status == false){
                        result.data = "reverted";
                        break;
                    }
                    if(bestBlock - receipt.blockNumber >= this.config.ethereum.confirmHeight){
                        result.data = "confirmed";
                        break;
                    } else {
                        continue;
                    }
                } else {
                    if(bestBlock - blockRef > this.config.ethereum.expiration){
                        result.data = "expired";
                        break;
                    }
                }
            } catch (error) {
                result.error = error;
                break;
            }
            await sleep(10 * 1000);
        }
        return result;
    }

    public async blockIsFork(bhash:string):Promise<ActionData<boolean>>{
        let result = new ActionData<boolean>();
        result.data = false;
        let blockHash = bhash; 
        let comfirmedCount = 0;
        try {
            while(true){
                const block = await this.web3.eth.getBlock(blockHash);
                if(block == null){
                    result.data = true;
                    return result;
                }
    
                const parentBlockHash = block.parentHash.toLowerCase();
                const parentBlock = await this.web3.eth.getBlock(block.number - 1);
                if(parentBlock == null){
                    result.data = true;
                    return result;
                }

                if(parentBlock.hash.toLowerCase() != parentBlockHash){
                    result.data = true;
                    return result;
                }
                blockHash = parentBlock.hash.toLowerCase();
                comfirmedCount++;
                if(comfirmedCount > this.config.ethereum.confirmHeight){
                    return result;
                }
            }
        } catch (error) {
            result.error = error;
            return result;
        }
    }

    public async getBlockIndex(begin:number,end:number):Promise<ActionData<BlockIndex[]>> {
        let result = new ActionData<BlockIndex[]>();
        result.data = new Array();

        try {
            for(let index = begin; index <= end;index++){
                const block = await this.web3.eth.getBlock(index);
                if(block == null){
                    break;
                }
                result.data.push({
                    chainName:this.config.ethereum.chainName as string,
                    chainId:this.config.ethereum.chainId as string,
                    blockId:block.hash,
                    blockNum:block.number,
                    timestamp:block.timestamp as number
                });
            }
        } catch (error) {
            result.error = error; 
        }

        return result;
    }

    private env:any;
    private config:any;
    private web3:Web3;
}
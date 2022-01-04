import { Framework } from "@vechain/connex-framework";
import { ActionData, ActionResult } from "./utils/components/actionResult";
import { BlockIndex } from "./utils/types/blockIndex";

export class VeChainCommon {
    constructor(env:any){
        this.env = env;
        this.config = env.config;
        this.connex = env.connex;
    }

    public async confirmTx(txid:string):Promise<ActionData<"reverted"|"confirmed"|"expired">>{
        let result = new ActionData<"reverted"|"confirmed"|"expired">();
        const blockRefNum = (await this.connex.thor.block().get())!.number;
        try {
            while(true){
                const bestBlock = (await this.connex.thor.block().get())!.number;
                const receipt = await this.connex.thor.transaction(txid).getReceipt();
                if(receipt != null){
                    const receiptBlockId = receipt.meta.blockID;
                    const receiptBlockNum = receipt.meta.blockNumber;
                    if(bestBlock - receiptBlockNum >= this.config.vechain.expiration && !this.blockIsFork(receiptBlockId)){
                        if(receipt.reverted == true){
                            result.data = "reverted";
                            console.warn(`Vechain Txid: ${txid} reverted`);
                            return result;
                        } else {
                            result.data = "confirmed";
                            return result;
                        }
                    } else {
                        continue;
                    }
                } else {
                    if(bestBlock - blockRefNum > this.config.vechain.expiration){
                        result.data = "expired";
                        return result;
                    }
                }
            }
        } catch (error) {
            result.error = new Error(`ConfirmTx error: ${error}`);
            return result;
        }
    }

    public async blockIsFork(id:string):Promise<ActionData<boolean>>{
        let result = new ActionData<boolean>();
        result.data = false;
        let blockId = id;
        let comfirmedCount = 0;

        try {
            while(true){
                const block = await this.connex.thor.block(blockId).get();
                if(block == null){
                    result.data = true;
                    return result;
                }
                const parentBlockId = block.parentID.toLowerCase();
                const parentBlock = await this.connex.thor.block(block.number - 1).get();
                if(parentBlock == null){
                    result.data = true;
                    return result;
                }

                if(parentBlock.id.toLowerCase() != parentBlockId){
                    result.data = true;
                    return result;
                }
                blockId = parentBlock.id.toLowerCase();
                comfirmedCount++;
                if(comfirmedCount > this.config.vechain.confirmHeight){
                    return result;
                }
            }
        } catch (error) {
            result.error = new Error(`Check block fork error: ${error}`);
            return result;
        }
    }

    public async checkTxStatus(txid:string,blockRef:number):Promise<ActionData<"reverted"|"confirmed"|"expired"|"pending">>{
        let result = new ActionData<"reverted"|"confirmed"|"expired"|"pending">();
        const bestBlock = (await this.connex.thor.block().get())!.number;

        try {
            const receipt = await this.connex.thor.transaction(txid).getReceipt();
            if(receipt != null && bestBlock - blockRef > this.config.vechain.confirmHeight){
                if(receipt.reverted){
                    result.data = "reverted";
                } else {
                    result.data = "confirmed";
                }
            } else if(bestBlock - blockRef > this.config.vechain.expiration) {
                result.data = "expired";
            } else {
                console.debug(`VeChain Tx: ${txid} pending ${bestBlock - blockRef}/${this.config.vechain.confirmHeight}`);
                result.data = "pending";
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getBlockIndex(begin:number,end:number):Promise<ActionData<BlockIndex[]>> {
        let result = new ActionData<BlockIndex[]>();
        result.data = new Array();

        try {
            for(let index = begin; index <= end;index++){
                const block = await this.connex.thor.block(index).get();
                if(block == null){
                    break;
                }
                result.data.push({
                    chainName:this.config.vechain.chainName as string,
                    chainId:this.config.vechain.chainId as string,
                    blockId:block.id,
                    blockNum:block.number,
                    timestamp:block.timestamp
                });
            }
        } catch (error) {
            result.error = error; 
        }
        return result;
    }
    
    private env:any;
    private config:any;
    private connex:Framework;
}
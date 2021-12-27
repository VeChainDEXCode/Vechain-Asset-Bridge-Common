import { Equal, getManager, getRepository } from "typeorm";
import { ActionData, ActionResult } from "../utils/components/actionResult";
import { BridgeSnapshoot } from "../utils/types/bridgeSnapshoot";
import { BaseBridgeTx,SwapBridgeTx,ClaimBridgeTx, bridgeTxId, swapTxHash, BridgeTxType } from "../utils/types/bridgeTx";
import { BridgeTxEntity } from "./entities/bridgeTx.entity";

export default class BridgeTxModel{
    constructor(env:any){
        this.env = env;
        this.config = env.config;
    }

    public async saveBridgeTxs(txs:BaseBridgeTx[]):Promise<ActionResult>{
        let result = new ActionResult();

        try {
            await getManager().transaction(async trans => {
                for(const tx of txs){
                    let entity = new BridgeTxEntity();
                    entity.bridgeTxId = bridgeTxId(tx);
                    entity.chainName = tx.chainName;
                    entity.chainId = tx.chainId;
                    entity.blockNumber = tx.blockNumber;
                    entity.blockId = tx.blockId;
                    entity.txid = tx.txid;
                    entity.clauseIndex = tx.clauseIndex;
                    entity.index = tx.index;
                    entity.token = tx.token;
                    entity.amount = '0x' + tx.amount.toString(16);
                    entity.timestamp = tx.timestamp;
                    entity.recipient = tx.recipient;entity.type
                    if(tx.type == BridgeTxType.swap){
                        entity.type = 1;
                        entity.swapTxHash = swapTxHash(tx as SwapBridgeTx);
                        entity.from = (tx as SwapBridgeTx).from;
                        entity.reward = '0x' + (tx as SwapBridgeTx).reward.toString(16);
                        entity.swapCount = '0x' + (tx as SwapBridgeTx).swapCount.toString(16);
                    } else {
                        entity.type = 2;
                        entity.swapTxHash = "";
                        entity.from = "";
                        entity.reward = "0x0";
                        entity.swapCount = "0x0";
                    }
                    await trans.save(entity);
                }
            })
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getLastBridgeTx(chainName:string,chainId:string):Promise<ActionData<BaseBridgeTx>>{
        let result = new ActionData<BaseBridgeTx>();

        try {
            let data:BridgeTxEntity = await getRepository(BridgeTxEntity)
            .findOne({
                chainName:Equal(chainName),
                chainId:Equal(chainId),
                valid:Equal(true)
            },{
                order:{
                    timestamp:"DESC"
                }
            });
            if(data != undefined){
                let tx:BaseBridgeTx = {
                    bridgeTxId:data.bridgeTxId,
                    chainName:data.chainName,
                    chainId:data.chainId,
                    blockNumber:data.blockNumber,
                    blockId:data.blockId,
                    txid:data.txid,
                    clauseIndex:data.clauseIndex,
                    index:data.index,
                    token:data.token,
                    amount:BigInt(data.amount),
                    timestamp:data.timestamp,
                    recipient:data.recipient,
                    type:data.type
                }
                if(tx.type == BridgeTxType.swap){
                    (tx as SwapBridgeTx).swapTxHash = data.swapTxHash;
                    (tx as SwapBridgeTx).from = data.from;
                    (tx as SwapBridgeTx).reward = BigInt(data.reward);
                    (tx as SwapBridgeTx).swapCount = BigInt(data.swapCount);
                }
                result.data = tx;
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async getClaimTxs(chainName:string,chainId:string,account:string,token?:string,begin?:number,end?:number,limit:number = 50,offset:number = 0):Promise<ActionData<ClaimBridgeTx[]>>{
        let result = new ActionData<ClaimBridgeTx[]>();
        result.data = new Array();

        try {
            let query = getRepository(BridgeTxEntity)
            .createQueryBuilder()
            .where("chainname = :name",{name:chainName})
            .andWhere("chainid = :id",{id:chainId})
            .andWhere("account = :account",{account:account.toLowerCase()})
            .andWhere("type = 2")
            .andWhere("valid = true")
            .orderBy("timestamp","DESC")
            .offset(offset)
            .limit(limit);

            query = begin != undefined ? query.andWhere("blocknumber >= :begin", {begin:begin}) : query;
            query = end != undefined ? query.andWhere("blocknumber <= :end", {end:end}) : query;
            query = token != undefined ? query.andWhere("token = :token",{token:token.toLowerCase()}) : query;

            const datas:BridgeTxEntity[] = await query.getMany();
        
            for(const data of datas){
                let claimTx:ClaimBridgeTx = {
                    bridgeTxId:data.bridgeTxId,
                    chainName:data.chainName,
                    chainId:data.chainId,
                    blockNumber:data.blockNumber,
                    blockId:data.blockId,
                    txid:data.txid,
                    clauseIndex:data.clauseIndex,
                    index:data.index,
                    token:data.token,
                    amount:BigInt(data.amount),
                    timestamp:data.timestamp,
                    recipient:data.recipient,
                    type:BridgeTxType.claim
                };
                result.data.push(claimTx);
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async getSwapTxs(chainName:string,chainId:string,account:string,token?:string,begin?:number,end?:number,limit?:number,offset:number = 0):Promise<ActionData<BridgeTx[]>>{
        let result = new ActionData<SwapBridgeTx[]>();
        result.data = new Array();

        try {
            let query = getRepository(BridgeTxEntity)
            .createQueryBuilder()
            .where("chainname = :name",{name:chainName})
            .andWhere("chainid = :id",{id:chainId})
            .andWhere("account = :account",{account:account.toLowerCase()})
            .andWhere("type = 1")
            .andWhere("valid = true")
            .orderBy("timestamp","DESC")
            .offset(offset)
            .limit(limit);

            query = begin != undefined ? query.andWhere("blocknumber >= :begin", {begin:begin}) : query;
            query = end != undefined ? query.andWhere("blocknumber <= :end", {end:end}) : query;
            query = token != undefined ?  query.andWhere("token = :token",{token:token.toLowerCase()}) :query;

            const data:BridgeTxEntity[] = await query.getMany();

            for(const item of data){
                let bridgeTx:SwapBridgeTx = {
                    bridgeTxId:item.bridgeTxId,
                    chainName:item.chainName,
                    chainId:item.chainId,
                    blockNumber:item.blockNumber,
                    blockId:item.blockId,
                    txid:item.txid,
                    clauseIndex:item.clauseIndex,
                    index:item.index,
                    token:item.token,
                    amount:BigInt(item.amount),
                    timestamp:item.timestamp,
                    recipient:item.recipient,
                    type:BridgeTxType.swap,
                    swapTxHash:item.swapTxHash,
                    from:item.from,
                    reward:BigInt(item.reward),
                    swapCount:BigInt(item.swapCount)
                    };
                result.data.push(bridgeTx);
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async getBridgeTxsBySnapshoot(sn:BridgeSnapshoot,limit?:number,offset:number = 0):Promise<ActionData<BaseBridgeTx[]>>{
        let result = new ActionData<BaseBridgeTx[]>();
        result.data = new Array();

        try {
            for(const chain of sn.chains){
                let query = getRepository(BridgeTxEntity)
                .createQueryBuilder()
                .where("chainname = :name",{name:chain.chainName})
                .andWhere("chainid = :id",{id:chain.chainId})
                .andWhere("blocknumber >= :begin",{begin:chain.beginBlockNum})
                .andWhere("blocknumber <= :end",{end:chain.endBlockNum - 1})
                .andWhere("valid = true")
                .limit(limit)
                .offset(offset)
                const data:BridgeTxEntity[] = await query.getMany();
                for(const item of data){
                    let bridgeTx:BaseBridgeTx = {
                        bridgeTxId:item.bridgeTxId,
                        chainName:item.chainName,
                        chainId:item.chainId,
                        blockNumber:item.blockNumber,
                        blockId:item.blockId,
                        txid:item.txid,
                        clauseIndex:item.clauseIndex,
                        index:item.index,
                        token:item.token,
                        amount:BigInt(item.amount),
                        timestamp:item.timestamp,
                        recipient:item.recipient,
                        type:item.type
                        };
                    if(bridgeTx.type == BridgeTxType.swap){
                        (bridgeTx as SwapBridgeTx).swapTxHash = item.swapTxHash;
                        (bridgeTx as SwapBridgeTx).from = item.from;
                        (bridgeTx as SwapBridgeTx).reward = BigInt(item.reward);
                        (bridgeTx as SwapBridgeTx).swapCount = BigInt(item.swapCount);
                    }
                    result.data.push(bridgeTx);
                }
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async removeByBlockIds(chainName:string,chainId:string,blockIds:string[]):Promise<ActionResult>{
        let result = new ActionResult();

        try {
            await getManager().transaction(async trans => {
                for(const blockId of blockIds){
                    await trans.update(
                        BridgeTxEntity,
                        {blockId:blockId,chainName:chainName,chainId:chainId},
                        {valid:false})
                }
            });
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    private env:any;
    private config:any;
}
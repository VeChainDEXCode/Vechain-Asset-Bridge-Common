import { getConnection, getManager, getRepository, SelectQueryBuilder } from "typeorm";
import { ActionData, ActionResult } from "../utils/components/actionResult";
import { BlockRange } from "../utils/types/blockRange";
import { BridgeSnapshoot, ZeroRoot } from "../utils/types/bridgeSnapshoot";
import { BaseBridgeTx } from "../utils/types/bridgeTx";
import { HashEvent, hashEventId } from "../utils/types/hashEvent";
import { HashEventEntity } from "./entities/hashEvent.entity";
import { SnapshootEntity } from "./entities/snapshoot.entity";

export class SnapshootModel {

    constructor(env:any){
        this.env = env;
        this.config = env.config;
    }

    public async getLastSnapshoot():Promise<ActionData<BridgeSnapshoot>>{
        let result = new ActionData<BridgeSnapshoot>();
        result.data = {
            merkleRoot:ZeroRoot(),
            chains:[
                {chainName:this.config.vechain.chainName,chainId:this.config.vechain.chainId,beginBlockNum:this.config.vechain.startBlockNum,endBlockNum:this.config.vechain.startBlockNum},
                {chainName:this.config.ethereum.chainName,chainId:this.config.ethereum.chainId,beginBlockNum:this.config.ethereum.startBlockNum,endBlockNum:this.config.ethereum.startBlockNum},
            ]
        }

        try {
            let data = await getRepository(SnapshootEntity)
                .createQueryBuilder()
                .orderBy("end_blocknum_0","DESC")
                .getOne();
            if(data != undefined){
                result.data = {
                    merkleRoot:data.merkleRoot,
                    chains:[
                        {chainName:data.chainName_0 || "",chainId:data.chainId_0 || "",beginBlockNum:data.beginBlockNum_0 || 0,endBlockNum:data.endBlockNum_0 || 0},
                        {chainName:data.chainName_1 || "",chainId:data.chainId_1 || "",beginBlockNum:data.beginBlockNum_1 || 0,endBlockNum:data.endBlockNum_1 || 0}
                    ]
                }
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async getSnapshootByRoot(root:string):Promise<ActionData<BridgeSnapshoot>>{
        let result = new ActionData<BridgeSnapshoot>();
        result.data = {
            merkleRoot:ZeroRoot(),
            chains:[
                { chainName:this.config.vechain.chainName,chainId:this.config.vechain.chainId,beginBlockNum:this.config.vechain.startBlockNum,endBlockNum:this.config.vechain.startBlockNum },
                { chainName:this.config.ethereum.chainName,chainId:this.config.ethereum.chainId,beginBlockNum:this.config.ethereum.startBlockNum,endBlockNum:this.config.ethereum.startBlockNum },
            ]
        }

        try {
            let data = await getRepository(SnapshootEntity)
                .findOne({where:{
                    merkleRoot:root,
                    valid:true
                }});
                if(data != undefined){
                    result.data = {
                        merkleRoot:data.merkleRoot,
                        chains:[
                            {chainName:data.chainName_0 || "",chainId:data.chainId_0 || "",beginBlockNum:data.beginBlockNum_0 || 0,endBlockNum:data.endBlockNum_0 || 0},
                            {chainName:data.chainName_1 || "",chainId:data.chainId_1 || "",beginBlockNum:data.beginBlockNum_1 || 0,endBlockNum:data.endBlockNum_1 || 0}
                        ]
                    }
                }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async deleteSnapshoot(root:string):Promise<ActionResult>{
        let result = new ActionResult();

        try {
            await getConnection()
            .createQueryBuilder()
            .delete()
            .from(SnapshootEntity)
            .where("merkleRoot = :merkleRoot", { merkleRoot: root })
            .execute();
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async save(sns:BridgeSnapshoot[],events:HashEvent[]):Promise<ActionResult>{
        let result = new ActionResult();

        try {
            await getManager().transaction(async trans => {
                for(const sn of sns){
                    let entity = new SnapshootEntity();
                    entity.merkleRoot = sn.merkleRoot;
                    const vechainInfo = sn.chains.find(chain => {return chain.chainName == this.config.vechain.chainName && chain.chainId == this.config.vechain.chainId;});
                    const ethereumInfo = sn.chains.find(chain => {return chain.chainName == this.config.ethereum.chainName && chain.chainId == this.config.ethereum.chainId;});
                    if(vechainInfo != undefined){
                        entity.chainName_0 = vechainInfo.chainName as string;
                        entity.chainId_0 = vechainInfo.chainId as string;
                        entity.beginBlockNum_0 = vechainInfo.beginBlockNum;
                        entity.endBlockNum_0 = vechainInfo.endBlockNum;
                    }

                    if(ethereumInfo != undefined){
                        entity.chainName_1 = ethereumInfo.chainName as string;
                        entity.chainId_1 = ethereumInfo.chainId as string;
                        entity.beginBlockNum_1 = ethereumInfo.beginBlockNum;
                        entity.endBlockNum_1 = ethereumInfo.endBlockNum;
                    }
                    await trans.save(entity);
                }

                for(const ev of events){
                    let entity = new HashEventEntity();
                    entity.eventId = hashEventId(ev);
                    entity.chainName = ev.chainId,
                    entity.chainId = ev.chainId,
                    entity.blockNumber = ev.blockNumber,
                    entity.blockId = ev.blockId,
                    entity.txid = ev.txid,
                    entity.index = ev.index,
                    entity.timestamp = ev.timestamp,
                    entity.appid = ev.appid,
                    entity.sender = ev.sender,
                    entity.hash = ev.hash
                    await trans.save(entity);
                }
            });
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getHashEventsByRange(chainname:string,chainid:string,range:BlockRange):Promise<ActionData<HashEvent[]>>{
        let result = new ActionData<HashEvent[]>();
        result.data = new Array();

        try {
            let query = getRepository(HashEventEntity)
            .createQueryBuilder()
            .where("chainname = :name",{name:chainname})
            .andWhere("chainid = :id",{id:chainid});

            query = range.blockNum != undefined && range.blockNum.from != undefined ? query.andWhere("blocknum >= :num",{num:range.blockNum.from}) : query;
            query = range.blockNum != undefined && range.blockNum.to != undefined ? query.andWhere("blocknum <= :num",{num:range.blockNum.to}) : query;
            query = range.blockids != undefined && range.blockids.length > 0 ? query.andWhere("blockid IN (:list)",{list:range.blockids}) : query;

            const datas = await query.getMany();
            for(const item of datas){
                let event:HashEvent = {
                    chainName:item.chainName,
                    chainId:item.chainId,
                    blockNumber:item.blockNumber,
                    blockId:item.blockId,
                    txid:item.txid,
                    index:item.index,
                    timestamp:item.timestamp,
                    appid:item.appid,
                    sender:item.sender,
                    hash:item.hash
                };
                result.data.push(event);
            }
        } catch (error) {
            result.error = error;
        }
        return result;

        return result;
    }

    private env:any;
    private config:any;
}
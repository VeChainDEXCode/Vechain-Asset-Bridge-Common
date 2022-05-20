import { ActionData, ActionResult } from "../utils/components/actionResult";
import { BlockIndex } from "../utils/types/blockIndex";
import { DataSource } from "typeorm";
import { BlockIndexEntity } from "./entities/blockIndex.entity";
import { keccak256 } from "thor-devkit";
import { BlockRange } from "../utils/types/blockRange";

export default class BlockIndexModel {
    constructor(env:any){
        this.dataSource = env.dataSource;
    }

    public async getBlockByTimestamp(chainname:string,chainid:string,beginTs?:number,endTs?:number,offset?:number,limit?:number):Promise<ActionData<BlockIndex[]>>{
        let result = new ActionData<BlockIndex[]>();
        result.data = new Array();

        try {
            let query = this.dataSource.getRepository(BlockIndexEntity)
            .createQueryBuilder()
            .where("chainname = :name",{name:chainname})
            .andWhere("chainid = :id",{id:chainid})
            .orderBy("timestamp","DESC")
            .offset(offset)
            .limit(limit);

            query = beginTs != undefined ? query.andWhere("timestamp >= :begin",{begin:beginTs}) : query;
            query = endTs != undefined ? query.andWhere("timestamp <= :end",{end:endTs}) : query;

            const datas = await query.getMany();
            for(const item of datas){
                let blockIndex:BlockIndex = {
                    chainName:chainname,
                    chainId:chainid,
                    blockId:item.blockId,
                    blockNum:item.blockNum,
                    timestamp:item.timestamp
                };
                result.data.push(blockIndex);
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getLatestBlock(chainname:string,chainid:string):Promise<ActionData<BlockIndex>> {
        let result = new ActionData<BlockIndex>();
        try {
            let query:any = await this.dataSource.getRepository(BlockIndexEntity)
            .createQueryBuilder()
            .where("chainname = :name",{name:chainname})
            .andWhere("chainid = :id",{id:chainid})
            .orderBy("blocknum","DESC")
            .getOne();
            if(query != undefined){
                result.data = {
                    chainName:chainname,
                    chainId:chainid,
                    blockId:query.blockId,
                    blockNum:query.blockNum,
                    timestamp:query.timestamp
                }
            }
        } catch (error) {
            result.error = error;   
        }
        return result;
    }

    public async getBlockByNumber(chainname:string,chainid:string,blocknum:number):Promise<ActionData<BlockIndex>>{
        let result = new ActionData<BlockIndex>();
        try {
            let query:any = await this.dataSource.getRepository(BlockIndexEntity)
            .createQueryBuilder()
            .where("chainname = :name",{name:chainname})
            .andWhere("chainid = :id",{id:chainid})
            .andWhere("blocknum = :num",{num:blocknum})
            .getOne();
            if(query != undefined){
                result.data = {
                    chainName:chainname,
                    chainId:chainid,
                    blockId:query.blockId,
                    blockNum:query.blockNum,
                    timestamp:query.timestamp
                }
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async save(blocks:BlockIndex[]):Promise<ActionResult>{
        let result = new ActionResult();
        try {
            await this.dataSource.transaction(async trans => {
                for(const block of blocks){
                    let entity = new BlockIndexEntity();
                    entity.indexid = this.pid(block.chainName,block.chainId,block.blockId);
                    entity.chainName = block.chainName;
                    entity.chainId = block.chainId;
                    entity.blockId = block.blockId;
                    entity.blockNum = block.blockNum;
                    entity.timestamp = block.timestamp;
                    await trans.save(entity);
                }
            });
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async removeByBlockRange(chainname:string,chainid:string,range:BlockRange):Promise<ActionResult>{
        let result = new ActionResult();

        try {
            let query = this.dataSource.createQueryBuilder()
            .delete()
            .from(BlockIndexEntity)
            .where("chainname = :name",{name:chainname})
            .andWhere("chainid = :id",{id:chainid})

            if((range.blockids != undefined && range.blockids.length > 0) || range.blockNum?.from != undefined || range.blockNum?.to != undefined){
                query = range.blockNum != undefined && range.blockNum.from != undefined ? query.andWhere("blocknum >= :num",{num:range.blockNum.from}) : query;
                query = range.blockNum != undefined && range.blockNum.to != undefined ? query.andWhere("blocknum <= :num",{num:range.blockNum.to}) : query;
                query = range.blockids != undefined && range.blockids.length > 0 ? query.andWhere("blockid IN (:list)",{list:range.blockids}) : query;

                await query.execute();   
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    private pid(chainName:string,chainId:string,blockId:string):string {
        let buff = Buffer.concat([
            Buffer.from(chainName),
            Buffer.from(chainId),
            Buffer.from(BigInt(blockId).toString(16),'hex'),
        ])
        return "0x" + keccak256(buff).toString('hex');
    }

    private dataSource:DataSource;
}
import { ActionData } from "../utils/components/actionResult";
import { BlockIndex } from "../utils/types/blockIndex";
import { createBlockIndex } from "./entities/blockIndex.dyentity";
import { getRepository } from "typeorm";

export default class BlockIndexModel {
    constructor(env:any){
        this.env = env;
        this.config = env.config;
    }

    public async getBlockByTimestamp(chainname:string,chainid:string,beginTs?:number,endTs?:number,offset?:number,limit?:number):Promise<ActionData<BlockIndex[]>>{
        let result = new ActionData<BlockIndex[]>();
        result.data = new Array();

        try {
            let entity = createBlockIndex(chainname,chainid);
            let query = getRepository(entity)
            .createQueryBuilder()
            .where("valid = true")
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

    private env:any;
    private config:any;
}
import { getManager, getRepository } from "typeorm";
import { ActionData, ActionResult } from "../utils/components/actionResult";
import { BlockRange } from "../utils/types/blockRange";
import { TokenInfo } from "../utils/types/tokenInfo";
import { TokenEntity } from "./entities/tokenInfo.entity";


export default class TokenInfoModel {

    public async getTokenInfos():Promise<ActionData<TokenInfo[]>>{
        let result = new ActionData<TokenInfo[]>();
        result.data = new Array<TokenInfo>();

        try {
            let data = await getRepository(TokenEntity)
                .createQueryBuilder()
                .getMany();
            for(const entity of data){
                let _new:TokenInfo = {
                    tokenid:entity.tokenid,
                    chainName:entity.chainName,
                    chainId:entity.chainId,
                    name:entity.name,
                    symbol:entity.symbol,
                    decimals:entity.decimals,
                    tokenAddr:entity.tokenAddr,
                    nativeCoin:entity.nativeCoin,
                    tokenType:Number(entity.tokenType),
                    targetTokenAddr:entity.targetTokenAddr,
                    targetChainName:entity.targetChainName,
                    targetChainId:entity.targetChainId,
                    begin:entity.begin,
                    end:entity.end,
                    reward:entity.reward,
                    updateBlockNum:entity.updateBlockNum,
                    updateBlockId:entity.updateBlockId
                }
                result.data.push(_new);
            }

        } catch (error) {
            result.error = new Error(`getTokenInfos faild: ${JSON.stringify(error)}`);
        }
        
        return result;
    }

    public async save(tokens:TokenInfo[]):Promise<ActionResult>{
        let result = new ActionResult();
        try {
            await getManager().transaction(async transactionalEntityManager => {
                for(const token of tokens){
                    let entity = new TokenEntity();
                    entity.tokenid = token.tokenid;
                    entity.chainName = token.chainName;
                    entity.chainId = token.chainId;
                    entity.name = token.name;
                    entity.symbol = token.symbol;
                    entity.decimals = token.decimals;
                    entity.tokenAddr = token.tokenAddr;
                    entity.tokenType = token.tokenType;
                    entity.nativeCoin = token.nativeCoin;
                    entity.targetTokenAddr = token.targetTokenAddr;
                    entity.targetChainName = token.targetChainName;
                    entity.targetChainId = token.targetChainId;
                    entity.begin = token.begin;
                    entity.end = token.end;
                    entity.reward = token.reward;
                    entity.updateBlockNum = token.updateBlockNum;
                    entity.updateBlockId = token.updateBlockId;
                    await transactionalEntityManager.save(entity);
                }
            });
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async removeByBlockRange(chainName:string,chainId:string,range:BlockRange):Promise<ActionResult>{
        let result = new ActionResult();
        try {
            await getManager().transaction(async trans => {
                let query = trans.createQueryBuilder()
                    .delete()
                    .from(TokenEntity)
                    .where('chainname = :name',{name:chainName})
                    .andWhere('chainid = :id',{id:chainId});
                
                if((range.blockids != undefined && range.blockids.length > 0) || range.blockNum?.from != undefined || range.blockNum?.to != undefined){
                    query = range.blockNum != undefined && range.blockNum.from != undefined ? query.andWhere("updateblocknum >= :num",{num:range.blockNum.from}) : query;
                    query = range.blockNum != undefined && range.blockNum.to != undefined ? query.andWhere("updateblocknum <= :num",{num:range.blockNum.to}) : query;
                    query = range.blockids != undefined && range.blockids.length > 0 ? query.andWhere("updateblockid IN (:list)",{list:range.blockids}) : query;
                    await query.execute();
                }
            });
        } catch (error) {
            result.error = error;
        }

        return result;
    }
}
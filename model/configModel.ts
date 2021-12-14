import { ActionData, ActionResult } from "../utils/components/actionResult";
import { getManager, getRepository,In } from "typeorm";
import { ConfigEntity } from "./entities/config.entity";

export default class ConfigModel {
    constructor(){}

    public async get(keys:string[]):Promise<ActionData<Array<{key:string,value:string|undefined}>>>{
        let result = new ActionData<Array<{key:string,value:string|undefined}>>();
        result.data = new Array();

        try {
            const datas = await getRepository(ConfigEntity)
                .find({key:In(keys)});
            for(const key of keys){
                const data = (datas as Array<any>).find(item => {item.key == key});
                result.data.push({key:key,value:data});
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async save(configs:Array<{key:string,value:string}>):Promise<ActionResult>{
        let result = new ActionResult();
        try {
            await getManager().transaction(async trans => {
                for(const config of configs){
                    let entity = new ConfigEntity();
                    entity.key = config.key;
                    entity.value = config.value;
                    await trans.save(entity);
                }
            });
        } catch (error) {
            result.error = error;
        }
        return result;
    }
}
import { ActionData, ActionResult } from "../utils/components/actionResult";
import { getManager, getRepository,In } from "typeorm";
import { ConfigEntity } from "./entities/config.entity";

export default class ConfigModel {
    constructor(){}

    public async get(keys:string[]):Promise<ActionData<Map<string,string>>>{
        let result = new ActionData<Map<string,string>>();
        result.data = new Map<string,string>();
        try {
            const datas = await getRepository(ConfigEntity)
                .find({key:In(keys)});
            for(const config of datas){
                result.data.set(config.key,config.value);
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async save(configs:Map<string,string>):Promise<ActionResult>{
        let result = new ActionResult();
        try {
            await getManager().transaction(async trans => {
                for(const config of configs){
                    let entity = new ConfigEntity();
                    entity.key = config[0];
                    entity.value = config[1];
                    await trans.save(entity);
                }
            });
        } catch (error) {
            result.error = error;
        }
        return result;
    }
}
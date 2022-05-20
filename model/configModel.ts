import { ActionData, ActionResult } from "../utils/components/actionResult";
import { DataSource,In } from "typeorm";
import { ConfigEntity } from "./entities/config.entity";

export default class ConfigModel {
    constructor(env:any){
        this.dataSource = env.dataSource;
    }

    public async get(keys:string[]):Promise<ActionData<Map<string,string>>>{
        let result = new ActionData<Map<string,string>>();
        result.data = new Map<string,string>();
        try {
            const datas = await this.dataSource.getRepository(ConfigEntity)
                .find({
                    where:{key:In(keys)}
                });
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
            await this.dataSource.transaction(async trans => {
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

    private dataSource:DataSource;
}
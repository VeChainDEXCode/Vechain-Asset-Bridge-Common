import { getConnection, getManager, getRepository } from "typeorm";
import { ActionData, ActionResult } from "../utils/components/actionResult";
import { Validator } from "../utils/types/validator";
import { ValidatorEntity } from "./entities/validator.entity";

export default class ValidatorModel {

    public async getValidators():Promise<ActionData<Validator[]>>{
        let result = new ActionData<Validator[]>();
        result.data = new Array<Validator>();

        try {
            let data = await getRepository(ValidatorEntity)
                .createQueryBuilder()
                .where("activate = true")
                .getMany();
            for(const entity of data){
                let _new:Validator = {
                    validator:entity.validator,
                    activate:entity.activate,
                    updateBlockNum:entity.updateBlockNum,
                    updateBlockId:entity.updateBlockId
                }
                result.data.push(_new);
            }
        } catch (error) {
            result.error = new Error(`getValidators faild: ${JSON.stringify(error)}`);
        }
        
        return result;
    }

    public async save(validators:Validator[]):Promise<ActionResult>{
        let result = new ActionResult();
        try {
            await getManager().transaction(async trans => {
                for(const verifier of validators){
                    let entity = new ValidatorEntity();
                    entity.validator = verifier.validator;
                    entity.activate = verifier.activate;
                    entity.updateBlockNum = verifier.updateBlockNum;
                    entity.updateBlockId = verifier.updateBlockId;
                    await trans.save(entity);
                }
            });
        } catch (error) {
            result.error = error;
        }
        return result;
    }
}
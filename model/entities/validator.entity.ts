import { Entity, PrimaryColumn, Column } from "typeorm";
import { fixedBytes } from "../../utils/extensions/transformers";

@Entity("validator")
export class ValidatorEntity{
    @PrimaryColumn({name:"validator"})
    public validator!:string;

    @Column({name:"status",type:"boolean"})
    public status!:boolean;

    @Column({name:"update",unsigned: true})
    public update!:number;

    @Column({name:"updateBlock"})
    public updateBlock!:string;

    @Column({name:"valid",type:"boolean",default:true})
    public valid!:boolean;
}
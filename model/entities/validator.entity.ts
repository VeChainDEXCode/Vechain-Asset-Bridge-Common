import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("validator")
export class ValidatorEntity{
    @PrimaryColumn({name:"validator"})
    public validator!:string;

    @Column({name:"activate",type:"boolean"})
    public activate!:boolean;

    @Column({name:"updateblocknum",unsigned: true})
    public updateBlockNum!:number;

    @Column({name:"updateblockid"})
    public updateBlockId!:string;
}
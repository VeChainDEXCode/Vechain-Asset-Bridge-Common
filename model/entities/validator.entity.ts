import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("validator")
export class ValidatorEntity{
    @PrimaryColumn({name:"validator"})
    public validator!:string;

    @Column({name:"status"})
    public status!:boolean;

    @Column({name:"update"})
    public update!:number;

    @Column({name:"updateBlock"})
    public updateBlock!:string;

    @Column({name:"valid"})
    public valid!:boolean;
}
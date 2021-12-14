import { Entity, PrimaryColumn, Column, Index } from "typeorm";

@Entity("config")
export class ConfigEntity {
    @Index()
    @Column({name:"key"})
    public key!:string;

    @Column({name:"value"})
    public value!:string;
}
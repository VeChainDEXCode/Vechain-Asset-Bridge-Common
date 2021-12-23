import { Column, Entity, Index, IsNull, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

export function createBlockIndex(chainname:string,chainid:string){
    @Entity(`blockindex_${chainname}_${chainid}`)
    class BlockIndexEntity {
        public static tableName = `blockindex_${chainname}_${chainid}`;

        @PrimaryColumn({name:"blockid"})
        @Index()
        public blockId!:string;

        @Column({name:"blocknum"})
        @Index()
        public blockNum!:number;

        @Column({name:"timestamp"})
        public timestamp!:number;

        @Column({name:"valid"})
        public valid!:boolean;
    }
    return BlockIndexEntity;
}
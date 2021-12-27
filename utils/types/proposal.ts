export type Proposal = {
    root:string;
    createBlock:number,
    executblock:number,
    executed:boolean;
    args:string[],
    signatures:string[]
}
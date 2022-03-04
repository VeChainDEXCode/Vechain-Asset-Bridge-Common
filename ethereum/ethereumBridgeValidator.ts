import Web3 from "web3";
import {Contract} from 'web3-eth-contract';
import path from "path";
import { compileContract } from "myvetools/dist/utils";
import { ActionData } from "../utils/components/actionResult";
import { RLP } from "thor-devkit";
import { SimpleWallet } from "@vechain/connex-driver";

export class EthereumBridgeValidatorReader {
    constructor(env:any){
        this.env = env;
        this.config = this.env.config;
        this.web3 = this.env.web3;
        this.initValidator();
    }

    public async getUpdateMerkleRootProposal(root:string,vbegin:number,vend:number,ebegin:number,eend:number):Promise<ActionData<BaseProposal>>{
        let result = new ActionData<BaseProposal>();
        try {
            const args = this.argsRLP.encode({vbegin:vbegin,vend:vend,ebegin:ebegin,eend:eend});
            const call = await this.bridgeValidator.methods.getMerkleRootProposal(root,args).call();
            let p:BaseProposal = {
                root:root,
                executed:Boolean(call)
            };
            result.data = p;
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    private initValidator(){
        this.bridgeValidator = this.env.contracts.ethereum.bridgeValidator;
    }

    protected env:any;
    protected config:any;
    protected web3!:Web3;
    protected bridgeValidator!:Contract;
    protected readonly argsRLP = new RLP({
        name:'range',
        kind:[
            {name:'vbegin',kind:new RLP.NumericKind(32)},
            {name:'vend',kind:new RLP.NumericKind(32)},
            {name:'ebegin',kind:new RLP.NumericKind(32)},
            {name:'eend',kind:new RLP.NumericKind(32)},
        ]
    });
}

export class EthereumBridgeValidator extends EthereumBridgeValidatorReader {
    
    constructor(env:any){
        super(env);
        this.wallet = this.env.wallet;
    }

    public async updateBridgeMerkleRoot(root:string,args:Buffer,signs:string[]):Promise<ActionData<string>>{
        let result = new ActionData<string>();
        try {
            const blockRef = await this.web3.eth.getBlockNumber();
            const expirnum = this.config.ethereum.expiration as number;
            const gasprice = await this.web3.eth.getGasPrice();
            const gas = await this.bridgeValidator.methods.updateBridgeMerkleRoot(root,args,signs,blockRef,expirnum)
                .estimateGas();
            const receipt = await this.bridgeValidator.methods.updateBridgeMerkleRoot(root,args,signs,blockRef,expirnum).send({
                from:this.wallet.list[0].address,
                gas:gas,
                gasprice:gasprice
            }).on('error',(error:any) => {
                console.warn(`ethereum update merkleroot tx error: ${error}`);
                result.error = error;
            });
            result.data = receipt.transactionHash;
        } catch (error) {
            result.error = error;
        }
        return result;
    }
    
    private wallet!:SimpleWallet;
}

export type BaseProposal = {
    root:string;
    executed:boolean;
}
import { SimpleWallet } from "@vechain/connex-driver";
import { Framework } from "@vechain/connex-framework";
import { Contract } from "myvetools";
import { compileContract } from "myvetools/dist/utils";
import path from "path";
import { abi, keccak256, RLP } from "thor-devkit";
import { ActionData } from "../utils/components/actionResult";
import { ZeroRoot } from "../utils/types/bridgeSnapshoot";
import { Proposal } from "../utils/types/proposal";
import { Validator } from "../utils/types/validator";
import { getAllEvents } from "./vechainCommon";

export class VeChainBridgeValidatorReader {
    constructor(env:any){
        this.env = env;
        this.connex = this.env.connex;
        this.config = this.env.config;
        this.initValidator();
    }

    public async isValidator(address:string):Promise<ActionData<boolean>>{
        let result = new ActionData<boolean>();
        try {
            const call = await this.bridgeValidator.call('validators',address);
            result.data = call.decoded[0];
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getMerkleRootProposals(root:string,vbegin:number,vend:number,ebegin:number,eend:number):Promise<ActionData<Proposal>>{
        let result = new ActionData<Proposal>();
        try {
            const args = this.argsRLP.encode({vbegin:vbegin,vend:vend,ebegin:ebegin,eend:eend});
            const call = await this.bridgeValidator.call("getMerkleRootProposal",root,args);
            let p:Proposal = {
                root:root,
                executed:call.decoded[0][0] != "0" ? true : false,
                createBlock:Number(call.decoded[0][1]),
                executblock:Number(call.decoded[0][2]),
                args:(call.decoded[0][4] as string),
                signatures:(call.decoded[0][5] as Array<string>)
            }
            result.data = p;
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getValidators(begin:number,end:number):Promise<ActionData<Validator[]>>{
        let result = new ActionData<Validator[]>();
        result.data = new Array();

        try {
            for(let block = begin; block <= end;){
                let from = block;
                let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;
    
                console.debug(`scan validators update: ${from} - ${to}`);
    
                const filter = this.connex.thor.filter('event',[{
                    address:this.config.vechain.contracts.bridgeValidator,
                    topic0:this.ValidatorChangedEvent.signature
                }]).order('asc').range({unit:'block',from:from,to:to});

                const events = await getAllEvents(filter);
                for(const ev of events){
                    const evDecode = this.ValidatorChangedEvent.decode(ev.data,ev.topics);
                    const validator:Validator = {
                        validator:evDecode[0] as string,
                        activate:evDecode[1] as boolean,
                        updateBlockNum:ev.meta.blockNumber,
                        updateBlockId:ev.meta.blockID
                    }
                    result.data.push(validator);
                }
                block = to + 1;
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    private initValidator(){
        const filePath = path.join(this.env.contractdir,"/vechain/Contract_VeChainBridgeValidator.sol");
        const validatorAbi = JSON.parse(compileContract(filePath,'VeChainBridgeValidator','abi',[this.env.contractdir]));
        this.bridgeValidator = new Contract({abi:validatorAbi,connex:this.connex,address:this.config.vechain.contracts.bridgeValidator});
        this.ValidatorChangedEvent = new abi.Event(this.bridgeValidator.ABI("ValidatorChanged","event") as any);
    }

    protected env:any;
    protected config:any;
    protected connex!:Framework;
    protected readonly scanBlockStep = 200;
    protected bridgeValidator!:Contract;
    protected ValidatorChangedEvent!:abi.Event;
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

export class VeChainBridgeValidator extends VeChainBridgeValidatorReader {

    constructor(env:any){
        super(env);
        this.wallet = this.env.wallet;
    }

    public async updateBridgeMerkleRoot(root:string,vbegin:number,vend:number,ebegin:number,eend:number):Promise<ActionData<string>> {
        let result = new ActionData<string>();
        try {
            const args = this.argsRLP.encode({vbegin:vbegin,vend:vend,ebegin:ebegin,eend:eend});
            const msgHash = this.signEncodePacked(root,args);
            const sign = await this.wallet.list[0].sign(msgHash);
            const clause = this.bridgeValidator.send('updateMerkleRoot',0,root,args,sign);
            const txrep = await this.connex.vendor.sign('tx',[clause])
                .signer(this.wallet.list[0].address)
                .gas(300000)
                .request();
            result.data = txrep.txid;
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    private signEncodePacked(root:string,args:Buffer):Buffer{
        let hashBuffer = root != ZeroRoot() ? Buffer.from(root.substring(2),'hex') : Buffer.alloc(32);
        let encode = Buffer.concat([
            hashBuffer,
            args
        ]);
        return keccak256(encode);
    }

    private wallet!:SimpleWallet;
}
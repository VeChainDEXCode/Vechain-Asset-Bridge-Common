import { Framework } from "@vechain/connex-framework";
import { Contract } from "myvetools";
import path from "path";
import { compileContract } from "myvetools/dist/utils";
import { abi, keccak256, Transaction } from "thor-devkit";
import { SimpleWallet } from "@vechain/connex-driver";
import { ActionData } from "./utils/components/actionResult";
import { Proposal } from "./utils/types/proposal";
import { ZeroRoot } from "./utils/types/bridgeSnapshoot";
import { sleep } from "./utils/sleep";
import { Verifier } from "./utils/types/validator";
import { ThorDevKitEx } from "./utils/extensions/thorDevkitExten";

export class VeChainBridgeVerifiterReader {
    constructor(env:any){
        this.env = env;
        this.connex = this.env.connex;
        this.config = this.env.config;
        this.initV2eVerifiter();
    }

    public async isVerifier(address:string):Promise<ActionData<boolean>>{
        let result = new ActionData<boolean>();
        try {
            const call = await this.v2eVerifiter.call("validators",address);
            result.data = BigInt(call.decoded[0]) != BigInt(0) ? true : false;
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getMerkleRootProposals(root:string):Promise<ActionData<Proposal>>{
        let result = new ActionData<Proposal>();

        try {
            const call = await this.v2eVerifiter.call("getMerkleRootProposal",root);
            let p:Proposal = {
                root:root,
                executed:call.decoded[0][0] != "0" ? true : false,
                createBlock:Number(call.decoded[0][1]),
                executblock:Number(call.decoded[0][2]),
                args:(call.decoded[0][4] as Array<string>),
                signatures:(call.decoded[0][5] as Array<string>)
            }
            result.data = p;
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    public async getVerifiers(begin:number,end:number):Promise<ActionData<Verifier[]>> {
        let result = new ActionData<Verifier[]>();
        result.data = new Array<Verifier>();

        try {
            for(let block = begin; block <= end;){
                let from = block;
                let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;

                console.debug(`scan verifiers update: ${from} - ${to}`);
                let offset = 0;
                while(true){
                    let events = await this.connex.thor.filter("event",[
                        {address:this.config.vechain.contracts.v2eBridgeVerifier,topic0:this.ValidatorChangedEvent.signature}
                    ]).order("asc").range({unit:"block",from:from,to:to}).apply(offset,200);
                
                    for(const event of events){
                        let validator:Valid
                    }
                }

            }
            // for(let block = begin; block <= end;){
            //     let from = block;
            //     let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;
    
            //     console.debug(`scan verifiers update: ${from} - ${to}`);

            //     let events = await this.connex.thor.filter("event",[
            //         {address:this.config.vechain.contracts.v2eBridgeVerifier,topic0:this.ValidatorChangedEvent.signature}
            //     ]).order("asc").range({unit:"block",from:from,to:to}).apply(0,200);

            //     for(const event of events){
            //         let verifier:Verifier = {
            //             verifier:ThorDevKitEx.Bytes32ToAddress(event.topics[1]),
            //             status:event.topics[2] == "0x0000000000000000000000000000000000000000000000000000000000000001" ? true : false,
            //             update:event.meta.blockNumber,
            //             updateBlock:event.meta.blockID
            //         };
            //         const index = result.data.findIndex(item =>{return item.verifier.toLowerCase() == verifier.verifier.toLowerCase()});
            //         if(index == -1){
            //             result.data.push(verifier);
            //         } else {
            //             result.data[index] = verifier;
            //         }
            //     }
            //     block = to + 1;
            // }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    private initV2eVerifiter(){
        const filePath = path.join(this.env.contractdir,"/vechainthor/Contract_BridgeValidator.sol");
        const validatorAbi = JSON.parse(compileContract(filePath, 'BridgeValidator', 'abi',[this.env.contractdir]));
        this.v2eVerifiter = new Contract({abi:validatorAbi,connex:this.connex,address:this.config.vechain.contracts.v2eBridgeValidator});
        this.ValidatorChangedEvent = new abi.Event(this.v2eVerifiter.ABI("ValidatorChanged","event") as any);
    }

    protected env:any;
    protected config:any;
    protected v2eVerifiter!:Contract;
    protected connex!:Framework;
    protected ValidatorChangedEvent!:abi.Event;
    protected readonly scanBlockStep = 500;
}
export class VeChainBridgeVerifiter extends VeChainBridgeVerifiterReader{

    constructor(env:any){
        super(env);
        this.wallet = this.env.wallet;
    }

    public async lockBridge(lastRoot:string):Promise<ActionData<string>>{
        let result = new ActionData<string>();

        try {
            const msgHash = this.signEncodePacked("lockBridge",lastRoot);
            const sign = await this.wallet.list[0].sign(msgHash);

            console.info(`signer ${this.wallet.list[0].address} sign: ${sign.toString('hex')}`);

            const clause = this.v2eVerifiter.send("lockBridge",0,lastRoot,sign);
            const txrep = await this.connex.vendor.sign("tx",[clause])
                .signer(this.wallet.list[0].address)
                .gas(250000)
                .request();
            result.data = txrep.txid;
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async updateBridgeMerkleRoot(lastRoot:string,newRoot:string):Promise<ActionData<string>>{
        let result = new ActionData<string>();

        try {
            const msgHash = this.signEncodePacked("updateBridgeMerkleRoot",newRoot);
            const sign = await this.wallet.list[0].sign(msgHash);
            const clause = this.v2eVerifiter.send("updateBridgeMerkleRoot",0,lastRoot,newRoot,sign);
            const txrep = await this.connex.vendor.sign("tx",[clause])
                .signer(this.wallet.list[0].address)
                .gas(250000)
                .request();
            result.data = txrep.txid;
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async checkTxStatus(txid:string,blockRef:number):Promise<ActionData<"reverted"|"confirmed"|"expired"|"pending">>{
        let result = new ActionData<"reverted"|"confirmed"|"expired"|"pending">();
        const bestBlock = (await this.connex.thor.block().get())!.number;

        try {
            const receipt = await this.connex.thor.transaction(txid).getReceipt();
            if(receipt != null && bestBlock - blockRef > this.config.vechain.confirmHeight){
                if(receipt.reverted){
                    result.data = "reverted";
                } else {
                    result.data = "confirmed";
                }
            } else if(bestBlock - blockRef > this.config.vechain.expiration) {
                result.data = "expired";
            } else {
                console.debug(`VeChain Tx: ${txid} pending ${bestBlock - blockRef}/${this.config.vechain.confirmHeight}`);
                result.data = "pending";
            }
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async confirmTx(txid:string):Promise<ActionData<"reverted"|"confirmed"|"expired">>{
        let result = new ActionData<"reverted"|"confirmed"|"expired">();
        const blockRefNum = (await this.connex.thor.block().get())!.number;
        while(true){
            const bestBlock = (await this.connex.thor.block().get())!.number;
            try {
                const receipt = await this.connex.thor.transaction(txid).getReceipt();
                if(receipt != null){
                    if(receipt.reverted){
                        result.data = "reverted";
                        console.info(`transaction ${txid} reverted`);
                        break;
                    }
                    if(bestBlock - receipt.meta.blockNumber >= this.config.vechain.confirmHeight){
                        result.data = "confirmed";
                        break;
                    } else {
                        continue;
                    }
                } else {
                    if(bestBlock - blockRefNum > this.config.vechain.expiration){
                        result.data = "expired";
                        break;
                    }
                }
            } catch (error) {
                result.error = error;
                break;
            }
            await sleep(10 * 1000);
        }
        
        return result;
    }

    private signEncodePacked(opertion:string,hash:string):Buffer{
        let hashBuffer = hash != ZeroRoot() ? Buffer.from(hash.substring(2),'hex') : Buffer.alloc(32);
        let encode = Buffer.concat([
            Buffer.from(opertion),
            hashBuffer
        ]);
        return keccak256(encode);
    }

    private wallet!:SimpleWallet;
}

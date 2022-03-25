import Web3 from "web3";
import { Contract,EventData } from "web3-eth-contract";
import path from "path";
import { compileContract } from "myvetools/dist/utils";
import { ActionData } from "../utils/components/actionResult";
import { BaseBridgeTx, bridgeTxId, BridgeTxType, ClaimBridgeTx, SwapBridgeTx, swapTxHash } from "../utils/types/bridgeTx";
import { tokenid, TokenInfo } from "../utils/types/tokenInfo";
import Web3Eth from 'web3-eth';
import { ERC20Token } from "./erc20Token";

export class EthereumFTBridge {

    constructor(env:any){
        this.env = env;
        this.web3 = env.web3;
        this.config = env.config;
        this.initContract();
    }

    public async getBridgeTxByRange(begin:number,end:number):Promise<ActionData<BaseBridgeTx[]>>{
        let result = new ActionData<BaseBridgeTx[]>();
        result.data = new Array();

        let blockCache:Map<string,Web3Eth.BlockTransactionString> = new Map();

        try {
            for(let block = begin;block <= end;){
                let from = block;
                let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;
                
                console.debug(`scan ethereum bridge txs blocknum: ${from} - ${to}`);

                const swapEvents = await this.ftBridge.getPastEvents('Swap',{fromBlock:from,toBlock:to});
                for(const swapEv of swapEvents){
                    if(!blockCache.has(swapEv.blockHash)){
                        const block = await this.web3.eth.getBlock(swapEv.blockHash);
                        blockCache.set(swapEv.blockHash,block);
                    }
                    const swaptx:SwapBridgeTx = {
                        bridgeTxId:"",
                        chainName:this.config.ethereum.chainName,
                        chainId:this.config.ethereum.chainId,
                        blockNumber:swapEv.blockNumber,
                        blockId:swapEv.blockHash,
                        txid:swapEv.transactionHash,
                        index:swapEv.logIndex,
                        swapTxHash:swapEv.returnValues[0] as string,
                        token:swapEv.returnValues[1] as string,
                        amount:BigInt(0),
                        timestamp:blockCache.get(swapEv.blockHash)!.timestamp as number,
                        recipient:swapEv.returnValues[2] as string,
                        type:BridgeTxType.swap,
                        from:swapEv.returnValues[3] as string,
                        amountOut:BigInt(swapEv.returnValues[4]),
                        reward:BigInt(swapEv.returnValues[5]),
                        swapCount:BigInt(swapEv.returnValues[6])
                    }
                    swaptx.bridgeTxId = bridgeTxId(swaptx);
                    swaptx.amount = swaptx.reward + swaptx.amountOut;
                    result.data.push(swaptx);
                }

                const claimEvents = await this.ftBridge.getPastEvents('Claim',{fromBlock:from,toBlock:to});
                for(const claimEv of claimEvents){
                    if(!blockCache.has(claimEv.blockHash)){
                        const block = await this.web3.eth.getBlock(claimEv.blockHash);
                        blockCache.set(claimEv.blockHash,block);
                    }
                    const claimtx:ClaimBridgeTx = {
                        bridgeTxId:"",
                        chainName:this.config.ethereum.chainName,
                        chainId:this.config.ethereum.chainId,
                        blockNumber:claimEv.blockNumber,
                        blockId:claimEv.blockHash,
                        txid:claimEv.transactionHash,
                        index:claimEv.logIndex,
                        swapTxHash:claimEv.returnValues[0] as string,
                        token:claimEv.returnValues[1] as string,
                        recipient:claimEv.returnValues[2] as string,
                        amount:BigInt(claimEv.returnValues[3]),
                        timestamp:blockCache.get(claimEv.blockHash)!.timestamp as number,
                        type:BridgeTxType.claim
                    }
                    claimtx.bridgeTxId = bridgeTxId(claimtx);
                    result.data!.push(claimtx);
                }
                block = to + 1;
            }   
        } catch (error) {
            result.error = error;
        }
        return result;
    }

    public async getTokenInfosByRange(begin:number,end:number):Promise<ActionData<TokenInfo[]>>{
        let result = new ActionData<TokenInfo[]>();
        result.data = new Array();

        try {
            for(let block = begin; block <= end;){
                let from = block;
                let to = block + this.scanBlockStep > end ? end:block + this.scanBlockStep;

                console.debug(`scan ethereum tokenInfos blocknum: ${from} - ${to}`);

                const events = await this.ftBridgeTokens.getPastEvents('TokenUpdated',{fromBlock:from,toBlock:to});
                for(const ev of events){
                    const tokenAddr = ev.returnValues[0] as string;
                    const token = new ERC20Token(tokenAddr,this.web3);
                    const baseInfo = await token.baseInfo();
                    const tokenInfo:TokenInfo = {
                        tokenid:"",
                        chainName:this.config.ethereum.chainName,
                        chainId:this.config.ethereum.chainId,
                        name:baseInfo.name,
                        symbol:baseInfo.symbol,
                        decimals:baseInfo.decimals,
                        tokenAddr:tokenAddr,
                        nativeCoin:ev.returnValues._native as boolean,
                        tokenType:ev.returnValues._type as number,
                        targetTokenAddr:ev.returnValues._token as string,
                        targetChainName:this.config.vechain.chainName,
                        targetChainId:this.config.vechain.chainId,
                        begin:ev.returnValues._begin as number,
                        end:ev.returnValues._end as number,
                        reward:ev.returnValues._reward as number,
                        updateBlockNum:ev.blockNumber,
                        updateBlockId:ev.blockHash
                    }
                    tokenInfo.tokenid = tokenid(tokenInfo.chainName,tokenInfo.chainId,tokenInfo.tokenAddr);
                    result.data.push(tokenInfo);
                }
                block = to + 1;
            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    private initContract(){
        this.ftBridge = this.env.contracts.ethereum.ftBridge;
        this.ftBridgeTokens = this.env.contracts.ethereum.ftBridgeTokens;
    }

    private env:any;
    private config:any;
    private web3!:Web3;
    private readonly scanBlockStep = 200;
    private ftBridge!:Contract;
    private ftBridgeTokens!:Contract;
}
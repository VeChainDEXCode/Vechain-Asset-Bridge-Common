import Web3 from "web3";
import { Contract,EventData } from "web3-eth-contract";
import path from "path";
import { compileContract } from "myvetools/dist/utils";
import { ActionData } from "../utils/components/actionResult";
import { BaseBridgeTx, bridgeTxId, BridgeTxType, ClaimBridgeTx, SwapBridgeTx, swapTxHash } from "../utils/types/bridgeTx";
import { TokenInfo } from "../utils/types/tokenInfo";
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
                        token:swapEv.returnValues[0] as string,
                        amount:BigInt(0),
                        timestamp:blockCache.get(swapEv.blockHash)!.timestamp as number,
                        recipient:swapEv.returnValues[2] as string,
                        type:BridgeTxType.swap,
                        swapTxHash:"",
                        from:swapEv.returnValues[1] as string,
                        reward:BigInt(swapEv.returnValues[4]),
                        amountOut:BigInt(swapEv.returnValues[3]),
                        swapCount:BigInt(swapEv.returnValues[5])
                    }
                    swaptx.bridgeTxId = bridgeTxId(swaptx);
                    swaptx.amount = swaptx.reward + swaptx.amountOut;
                    swaptx.swapTxHash = swapTxHash(swaptx);
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
                        token:claimEv.returnValues[0] as string,
                        amount:BigInt(claimEv.returnValues[2]),
                        timestamp:blockCache.get(claimEv.blockHash)!.timestamp as number,
                        recipient:claimEv.returnValues[1] as string,
                        type:BridgeTxType.claim
                    }
                    claimtx.bridgeTxId = bridgeTxId(claimtx);
                    result.data!.push(claimtx);
                }
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
                    const call = await this.ftBridgeTokens.methods.tokens(tokenAddr).call();
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
                        nativeCoin:baseInfo.symbol.toUpperCase() == "WETH" ? true : false,
                        tokenType:call.returnValues[0] as number,
                        targetTokenAddr:call.returnValues[1] as string,
                        targetChainName:call.returnValues[2] as string,
                        targetChainId:call.returnValues[3] as string,
                        begin:call.returnValues[4] as number,
                        end:call.returnValues[5] as number,
                        reward:call.returnValues[6] as number,
                        updateBlockNum:ev.blockNumber,
                        updateBlockId:ev.blockHash
                    }
                    result.data.push(tokenInfo);
                }

            }
        } catch (error) {
            result.error = error;
        }

        return result;
    }

    private initContract(){
        const ftBridgeFile = path.join(this.env.contractdir,'/common/Contract_FTBridge.sol');
        const ftBridgeAbi = JSON.parse(compileContract(ftBridgeFile,'FTBridge','abi'));
        this.ftBridge = new this.web3.eth.Contract(ftBridgeAbi,this.config.ethereum.ftBridge);

        const ftBridgeTokensFile = path.join(this.env.contractdir,'/common/Contract_FTBridgeTokens.sol');
        const ftBridgeTokensAbi = JSON.parse(compileContract(ftBridgeTokensFile,'FTBridgeTokens','abi'));
        this.ftBridgeTokens = new this.web3.eth.Contract(ftBridgeTokensAbi,this.config.ethereum.ftBridgeTokens);
    }

    private env:any;
    private config:any;
    private web3!:Web3;
    private readonly scanBlockStep = 200;
    private ftBridge!:Contract;
    private ftBridgeTokens!:Contract;
}
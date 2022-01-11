import { keccak256 } from "thor-devkit";
import { ActionResult } from "./utils/components/actionResult";
import MerkleTree, { TreeNode } from "./utils/merkleTree";
import { BridgeSnapshoot, ChainInfo } from "./utils/types/bridgeSnapshoot";
import { SwapBridgeTx, swapTxHash } from "./utils/types/bridgeTx";

export default class BridgeStorage {

    private tree:MerkleTree;
    private merkleRootNode:TreeNode;

    constructor(){
        this.tree = MerkleTree.createNewTree();
        this.merkleRootNode = TreeNode.EmptyTreeNode();
    }

    public buildTree(newSnapshoot:BridgeSnapshoot,txs:SwapBridgeTx[]):TreeNode {
        this.tree = MerkleTree.createNewTree();
        const sorted:Array<SwapBridgeTx> = txs.sort((l,r) => {
            return BigInt(l.swapTxHash) > BigInt(r.swapTxHash) ? 1 : -1;
        });
        
        let infoHash = BridgeStorage.snapshootHash(newSnapshoot.chains);
        this.tree.addHash(infoHash);
        sorted.forEach(tx => {
            this.tree.addHash(tx.swapTxHash);
        });

        this.merkleRootNode = this.tree.buildTree();
        return this.merkleRootNode;
    }

    public getMerkleRoot():string{
        return this.merkleRootNode.nodeHash;
    }

    public getMerkleProof(swapTxHash:string):Array<string>{
        return this.tree.getMerkleProof(swapTxHash);
    }

    public static verificationMerkleProof(swaptx:SwapBridgeTx,root:string,proof:Array<string>):boolean{
        let leafHash = swapTxHash(swaptx);
        return MerkleTree.verificationMerkleProof(leafHash,root,proof);
    }

    public static snapshootEncodePacked(chains:ChainInfo[]):Buffer {
        let sorted = chains.sort((l,r) => {
            if(l.chainName.toLocaleLowerCase() != r.chainName.toLocaleLowerCase()){
                return l.chainName > r.chainName ? 1 : -1 ;
            } else {
                return l.chainId >= r.chainId ? 1 : -1 ;
            }
        });

        let encode:Buffer = Buffer.alloc(0);
        sorted.forEach(chain => {
            let chainBuff = Buffer.concat([
                Buffer.from(chain.chainName),
                Buffer.from(chain.chainId),
                Buffer.from(BigInt(chain.beginBlockNum).toString(16),'hex'),
                Buffer.from(BigInt(chain.endBlockNum).toString(16),'hex'),
            ]);
            encode = Buffer.concat([chainBuff]);
        });

        return encode;
    }

    public static snapshootHash(chains:ChainInfo[]):string {
        return '0x' + keccak256(BridgeStorage.snapshootEncodePacked(chains)).toString('hex');
    }
    
}
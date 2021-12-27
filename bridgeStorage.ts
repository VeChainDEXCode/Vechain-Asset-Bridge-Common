import { keccak256 } from "thor-devkit";
import { ActionResult } from "./utils/components/actionResult";
import MerkleTree, { TreeNode } from "./utils/merkleTree";
import { BridgeSnapshoot, ChainInfo } from "./utils/types/bridgeSnapshoot";
import { SwapBridgeTx, swapTxHash } from "./utils/types/bridgeTx";
const sortArray = require('sort-array');
const Copy = require('object-copy');

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
            return BigInt(l.bridgeTxId) > BigInt(r.bridgeTxId) ? 1 : -1;
        });
        
        let infoHash = BridgeStorage.snapshootHash(newSnapshoot.chains);
        this.tree.addHash(infoHash);
        sorted.forEach(tx => {
            this.tree.addHash(tx.bridgeTxId);
        });

        this.merkleRootNode = this.tree.buildTree();
        return this.merkleRootNode;
    }

    public getMerkleRoot():string{
        return this.merkleRootNode.nodeHash;
    }

    public static verificationMerkleProof(swaptx:SwapBridgeTx,root:string,proof:Array<string>):boolean{
        let leafHash = swapTxHash(swaptx);
        return MerkleTree.verificationMerkleProof(leafHash,root,proof);
    }

    public static snapshootEncodePacked(chains:ChainInfo[]):Buffer {
        let sorted:Array<ChainInfo> = sortArray(chains,{
            by:['chainName','chainId'],
            order:'asc'
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
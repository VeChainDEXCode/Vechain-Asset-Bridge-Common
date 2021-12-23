// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../common/Library_ECVerify.sol";
import "../common/Library_Array.sol";
import "../common/Interface_Bridge.sol";

contract BridgeValidatorControl {
    address public master;
    address public governance;
    address public bridge;
    mapping(address => bool) public validators;
    uint8 public validatorCount;
    uint8 public proposalExp = 30;
    uint8 public proposalSubmitExp = 3;

    event MasterChanged(address indexed _prev, address indexed _new);
    event ValidatorChanged(address indexed _validator, bool indexed _status);
    event GovernanceUpdate(address indexed _prev, address indexed _new);
    event BridgeUpdate(address indexed _prev,address indexed _new);
    event ProposalExpChanged(uint8 indexed _prev,uint8 indexed _value);
    event ProposalSubmitExpChanged(uint8 indexed _prev,uint8 indexed _value);

    function setMaster(address _new) external onlyMaster {
        emit MasterChanged(master, _new);
        master = _new;
    }

    function setGovernance(address _new) external {
        require(
            msg.sender == governance || msg.sender == master,
            "Permission denied:only master or governance"
        );
        emit GovernanceUpdate(governance, _new);
        governance = _new;
    }

    function setBridge(address _new) external onlyGovernance {
        emit BridgeUpdate(bridge,_new);
        bridge = _new;
    }

    function addValidator(address _new) external onlyGovernance {
        require(validators[_new] == false,"The address is alreadly the validator");
        validators[_new] = true;
        validatorCount++;
        emit ValidatorChanged(_new,true);
    }

    function removeValidator(address _old) external onlyGovernance {
        require(validators[_old] == true,"The address is not a validator");
        validators[_old] = false;
        validatorCount--;
        emit ValidatorChanged(_old,false);
    }

    function setProposalExp(uint8 _new) external onlyGovernance {
        emit ProposalExpChanged(proposalExp,_new);
        proposalExp = _new;
    }

    function setProposalSubmitExp(uint8 _new) external onlyGovernance {
        emit ProposalSubmitExpChanged(proposalSubmitExp,_new);
        proposalSubmitExp = _new;
    }

    modifier onlyMaster() {
        require(msg.sender == master, "Permission denied:only master");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Permission denied:only governance");
        _;
    }
}

contract BridgeValidator is BridgeValidatorControl {
    struct Proposal {
        bool executed;
        uint256 createBlock;
        uint256 executblock;
        bytes32 root;
        bytes[] args;
        bytes[] signatures;
    }

    mapping(bytes32 => Proposal) public merkleRootProposals;

    event SubmitUpdateRoot(
        bytes32 indexed _value,
        address indexed _verifier,
        bytes _sig
    );

    event ExecOpertion(bytes32 indexed _hash);

    constructor() {
        master = msg.sender;
    }

    function updateMerkleRoot(
        bytes32 _root,
        bytes[] calldata _args,
        bytes calldata _sig
    ) external returns(bool){
        
        require(
            block.number - merkleRootProposals[_root].createBlock <= proposalExp,
            "the proposal had expired"
        );

        require(
            merkleRootProposals[_root].executed == false || (merkleRootProposals[_root].executed == true && block.number - merkleRootProposals[_root].executblock <= proposalSubmitExp),
            "the proposal had executed or submit expired"
        );

        address signer = ECVerify.ecrecovery(_root, _sig);
        require(validators[signer], "signer isn't a verifier");

        if(merkleRootProposals[_root].createBlock == 0){
            Proposal memory _new = Proposal({
                executed:false,
                createBlock:block.number,
                executblock:0,
                root:_root,
                args:_args,
                signatures: new bytes[](0)
            });
            merkleRootProposals[_root] = _new;
        }
        Proposal storage prop = merkleRootProposals[_root];

        require(
            ArrayLib.bytesExists(prop.signatures, _sig) == false,
            "signer already submitted"
        );
        prop.signatures.push(_sig);
        emit SubmitUpdateRoot(_root, signer, _sig);

        if (merkleRootProposals[_root].signatures.length >= quorum(validatorCount) && prop.executed == false) {
            IBridge bri = IBridge(bridge);
            bri.updateMerkleRoot(_root, merkleRootProposals[_root].args);
            prop.executed = true;
            prop.executblock = block.number;
            emit ExecOpertion(_root);
        }
        return true;
    }

    function getMerkleRootProposal(bytes32 _root)
        external
        view
        returns (Proposal memory) 
    {
        return merkleRootProposals[_root];
    }

    function quorum(uint8 total) internal pure returns (uint8) {
        return uint8(((uint256(total) + 1) * 2) / 3);
    }
}
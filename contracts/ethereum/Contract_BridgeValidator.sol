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

    event MasterChanged(address indexed _prev, address indexed _new);
    event ValidatorChanged(address indexed _validator, bool indexed _status);
    event GovernanceUpdate(address indexed _prev, address indexed _new);
    event BridgeUpdate(address indexed _prev,address indexed _new);

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
    mapping(bytes32 => bool) public merkleRootProposals;

    event UpdateBridgeMerkleRoot(bytes32 indexed _value);
    event ExecOperation(bytes32 indexed _hash);

    constructor(){
        master = msg.sender;
    }

    function updateBridgeMerkleRoot(
        bytes32 _root,
        bytes[] calldata _args,
        bytes[] calldata _sigs,
        uint _blockRef,
        uint _expirnum
    ) external {
        require(expiration(_blockRef,_expirnum),"the transaction already expired");

        require(merkleRootProposals[_root] == false,"the operation had executed");

        IBridge bridge = IBridge(bridge);
        uint8 limit = quorum(validatorCount);
        require(_sigs.length + 1 >= limit, "Insufficient number of signatures");

        address[] memory signers = new address[](_sigs.length);
        for (uint8 i = 0; i < _sigs.length; i++) {
            address signer = ECVerify.ecrecovery(_root, _sigs[i]);
            require(validators[signer], "signer isn't a verifier");
            require(ArrayLib.addressExist(signers,signer) == false,"signer had approved");
            signers[i] = signer;
            emit UpdateBridgeMerkleRoot(_root);
            if (i + 1 >= limit) {
                bridge.updateMerkleRoot(_root,_args);
                merkleRootProposals[_root] = true;
                emit ExecOperation(_root);
                break;
            }
        }
    }


    function quorum(uint8 total) internal pure returns (uint8) {
        return uint8(((uint256(total) + 1) * 2) / 3);
    }

    function expiration(uint blockRef,uint expirnum) internal view returns(bool) {
        return block.number - blockRef <= expirnum;
    }
}
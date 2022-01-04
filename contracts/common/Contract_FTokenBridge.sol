// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./Interface_Bridge.sol";
import "./Interface_Token.sol";
import "./Interface_TokenExtension.sol";
import "./Library_Merkle.sol";

interface INativeCoin is IToken {
    function deposit() external payable;

    function withdraw(uint256 _amount) external;
}

contract FTokenBridgeControl {
    address public master; //Master contract
    address public governance; //Governance contract
    address public validator; //Validator contract

    uint16 public reward = 0; //Range 0-1000 (0‰ - 100‰)
    address public wrappedNativeCoin;
    bool public govLocked = false;
    bool public masterLocked = false;

    uint8 public constant FREEZE = 0;
    uint8 public constant ORIGINTOKEN = 1;
    uint8 public constant WRAPPEDTOKEN = 2;

    event MasterChanged(address indexed _prev, address indexed _new);
    event GovernanceChanged(address indexed _prev, address indexed _new);
    event VerifierChanged(address indexed _prev, address indexed _new);
    event RewardChanged(uint16 indexed _prev, uint16 indexed _value);
    event TokenUpdated(
        address indexed _tokenAdd,
        uint8 _type,
        address _ttoken,
        string _tchainname,
        string _tchainid,
        uint256 _begin,
        uint256 _end
    );
    event MasterLockChanged(bool indexed _value);
    event GovLockChanaged(bool indexed _value);

    struct TokenInfo {
        uint8 tokenType;
        address tToken;
        string tChainname;
        string tChainId;
        uint256 begin;
        uint256 end;
    }

    mapping(address => TokenInfo) public tokens;

    function setMaster(address _new) external onlyMaster {
        emit MasterChanged(master, _new);
        master = _new;
    }

    function setGovernance(address _new) external {
        require(
            msg.sender == governance || msg.sender == master,
            "Permission denied"
        );
        emit GovernanceChanged(governance, _new);
        governance = _new;
    }

    function setValidator(address _new) external onlyGovernance {
        emit VerifierChanged(validator, _new);
        validator = _new;
    }

    function setToken(
        address _token,
        uint8 _type,
        address _ttoken,
        string calldata _tchainname,
        string calldata _tchainid,
        uint256 _begin,
        uint256 _end
    ) external onlyGovernance {
        if (tokens[_token].tokenType == 0) {
            tokens[_token] = TokenInfo({
                tokenType: _type,
                tToken: _ttoken,
                tChainname: _tchainname,
                tChainId: _tchainid,
                begin: _begin,
                end: _end
            });
        } else {
            TokenInfo storage info = tokens[_token];
            info.tokenType = _type;
            info.tToken = _ttoken;
            info.tChainname = _tchainname;
            info.tChainId = _tchainid;
            info.begin = _begin;
            info.end = _end;
        }
        emit TokenUpdated(
            _token,
            _type,
            _ttoken,
            _tchainname,
            _tchainid,
            _begin,
            _end
        );
    }

    function setWrappedNativeCoin(
        address _token,
        address _ttoken,
        string calldata _tchainname,
        string calldata _tchainid,
        uint256 _begin,
        uint256 _end
    ) external onlyGovernance {
        wrappedNativeCoin = _token;
        tokens[_token] = TokenInfo({
            tokenType: ORIGINTOKEN,
            tToken: _ttoken,
            tChainname: _tchainname,
            tChainId: _tchainid,
            begin: _begin,
            end: _end
        });
        emit TokenUpdated(
            _token,
            ORIGINTOKEN,
            _ttoken,
            _tchainname,
            _tchainid,
            _begin,
            _end
        );
    }

    function tokenActivate(address _token) external view returns (bool) {
        return
            (tokens[_token].tokenType == ORIGINTOKEN ||
                tokens[_token].tokenType == WRAPPEDTOKEN) &&
            (tokens[_token].begin <= block.number &&
                (tokens[_token].end >= block.number ||
                    tokens[_token].end == 0));
    }

    function setReward(uint16 _reward) external onlyGovernance {
        emit RewardChanged(reward, _reward);
        require(_reward >= 0 && _reward < 1000, "reward range is 0 to 1000");
        reward = _reward;
    }

    function setMasterLock(bool _value) external onlyMaster {
        masterLocked = _value;
        emit MasterLockChanged(_value);
    }

    function setGovLock(bool _value) external onlyGovernance {
        govLocked = _value;
        emit GovLockChanaged(_value);
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Permission denied");
        _;
    }

    modifier onlyMaster() {
        require(msg.sender == master, "Permission denied");
        _;
    }

    modifier onlyValidator() {
        require(msg.sender == validator, "Permission denied");
        _;
    }

    modifier masterUnlock() {
        require(masterLocked == false, "Master Lock bridge");
        _;
    }

    modifier govUnlock() {
        require(govLocked == false, "Governance Lock bridge");
        _;
    }
}

contract FTokenBridge is FTokenBridgeControl, IBridge {
    string public chainname;
    string public chainid;

    mapping(bytes32 => mapping(bytes32 => bool)) public claimed;
    mapping(bytes32 => bool) public merkleroots;
    uint256 public swapCount;

    event Swap(
        address indexed _token,
        address indexed _from,
        address indexed _recipient,
        uint256 _amountOut,
        uint256 _reward,
        uint256 _swapcount
    );

    event Claim(
        address indexed _token,
        address indexed _recipient,
        uint256 _amount
    );

    event TransaferByMaster(
        address indexed _token,
        address indexed _recipient,
        uint256 _amount
    );

    constructor(string memory _chainname, string memory _chainid) {
        chainname = _chainname;
        chainid = _chainid;
        master = msg.sender;
        governance = msg.sender;
    }

    function updateMerkleRoot(bytes32 _root, bytes[] calldata _args)
        external
        override
        onlyValidator
        masterUnlock
        govUnlock
    {
        merkleroots[_root] = true;
        emit UpdateMerkleRoot(_root, _args);
    }

    function proofVerify(
        bytes32 _root,
        bytes32 _leaf,
        bytes32[] calldata _proof
    ) public view override returns (bool) {
        require(merkleroots[_root] == true, "The merkleroot invalid");
        return MerkleProof.verify(_proof, _root, _leaf);
    }

    function swap(
        address _token,
        uint256 _amount,
        address _recipient
    ) external masterUnlock govUnlock returns (bool) {
        require(this.tokenActivate(_token), "The token unactivate");

        if (tokens[_token].tokenType == ORIGINTOKEN) {
            swapOriginToken(_token, _amount);
        }

        if (tokens[_token].tokenType == WRAPPEDTOKEN) {
            swapWrappedToken(_token, _amount);
        }
        swapCount++;
        (uint256 amountOut, uint256 reward) = amountReward(_amount);
        bytes32 swaphash = keccak256(
            abi.encodePacked(
                chainname,
                chainid,
                _recipient,
                _token,
                amountOut,
                swapCount
            )
        );
        emit SubmitHashEvent(swaphash);
        emit Swap(_token, msg.sender, _recipient, amountOut, reward, swapCount);
        return true;
    }

    function swapNativeCoin(address _recipient)
        external
        payable
        masterUnlock
        govUnlock
        returns (bool)
    {
        require(this.tokenActivate(wrappedNativeCoin), "Token unactivate");
        IToken token = IToken(wrappedNativeCoin);

        uint256 beforeBlance = token.balanceOf(address(this));
        INativeCoin(wrappedNativeCoin).deposit{value: msg.value}();
        uint256 afterBalance = token.balanceOf(address(this));

        require(
            afterBalance - beforeBlance == msg.value,
            "Transfer balance check faild"
        );

        (uint256 amountOut, uint256 reward) = amountReward(msg.value);
        bytes32 swaphash = keccak256(
            abi.encodePacked(
                chainname,
                chainid,
                _recipient,
                wrappedNativeCoin,
                amountOut,
                swapCount
            )
        );
        emit SubmitHashEvent(swaphash);
        emit Swap(
            wrappedNativeCoin,
            msg.sender,
            _recipient,
            amountOut,
            reward,
            swapCount
        );
        return true;
    }

    function claim(
        address _token,
        address _recipient,
        uint256 _amount,
        uint256 _swapcount,
        bytes32 _root,
        bytes32[] calldata _merkleProof
    ) external masterUnlock govUnlock returns (bool) {
        require(this.tokenActivate(_token), "Token unactivate");
        bytes32 swaphash = keccak256(
            abi.encodePacked(
                tokens[_token].tChainname,
                tokens[_token].tChainId,
                _recipient,
                tokens[_token].tToken,
                _amount,
                _swapcount
            )
        );

        require(proofVerify(_root, swaphash, _merkleProof), "Invalid proof");
        require(!isClaim(_root, swaphash), "The swap has been claimed");

        if (tokens[_token].tokenType == ORIGINTOKEN) {
            claimOrginToken(_token, _recipient, _amount);
        }

        if (tokens[_token].tokenType == WRAPPEDTOKEN) {
            claimWrappedToken(_token, _recipient, _amount);
        }

        setClaim(_root, swaphash);
        emit Claim(_token, _recipient, _amount);

        return true;
    }

    function claimNativeCoin(
        address payable _recipient,
        uint256 _amount,
        uint256 _swapcount,
        bytes32 _root,
        bytes32[] calldata _merkleProof
    ) external masterUnlock govUnlock returns (bool) {
        require(
            tokens[wrappedNativeCoin].tokenType == ORIGINTOKEN ||
                tokens[wrappedNativeCoin].tokenType == WRAPPEDTOKEN,
            "Native token unactivate"
        );
        
        bytes32 swaphash = keccak256(
            abi.encodePacked(
                tokens[wrappedNativeCoin].tChainname,
                tokens[wrappedNativeCoin].tChainId,
                _recipient,
                tokens[wrappedNativeCoin].tToken,
                _amount,
                _swapcount
            )
        );

        require(proofVerify(_root, swaphash, _merkleProof), "Invalid proof");
        require(!isClaim(_root, swaphash), "The swap has been claimed");

        claimNativeCoin(_recipient, _amount);
        setClaim(_root, swaphash);

        emit Claim(wrappedNativeCoin, _recipient, _amount);

        return true;
    }

    function tokenControlByMaster(address _token,bytes calldata _data) external onlyMaster {
        require(tokens[_token].tokenType == ORIGINTOKEN || tokens[_token].tokenType == WRAPPEDTOKEN,"The address isn't in tokenlist");
        if (masterLocked == false) {
            masterLocked = true;
            emit MasterLockChanged(true);
        }
        (bool success,bytes memory d) = _token.call(_data);
        require(success,"execution reverted");
    }

    function swapWrappedToken(address _token, uint256 _amount) private {
        ITokenExtension token = ITokenExtension(_token);
        require(token.balanceOf(msg.sender) >= _amount, "Insufficient balance");

        require(
            token.allowance(msg.sender, address(this)) >= _amount,
            "Insufficient allowance"
        );

        uint256 beforeBalance = token.balanceOf(address(this));
        token.transferFrom(msg.sender, address(this), _amount);
        uint256 afterBalance = token.balanceOf(address(this));
        require(
            afterBalance - beforeBalance == _amount,
            "TransferFrom balance check faild"
        );

        uint256 beforeBurn = token.balanceOf(address(this));
        token.burn(_amount);
        (address(this), _amount);
        uint256 afterBurn = token.balanceOf(address(this));

        require(
            beforeBurn - afterBurn == _amount,
            "recovery balance check faild"
        );
    }

    function swapOriginToken(address _token, uint256 _amount) private {
        IToken token = IToken(_token);
        require(token.balanceOf(msg.sender) >= _amount, "Insufficient balance");

        require(
            token.allowance(msg.sender, address(this)) >= _amount,
            "Insufficient allowance"
        );

        uint256 beforeBlance = token.balanceOf(address(this));
        token.transferFrom(msg.sender, address(this), _amount);
        uint256 afterBalance = token.balanceOf(address(this));

        require(
            afterBalance - beforeBlance == _amount,
            "Transfer balance check faild"
        );
    }

    function amountReward(uint256 _amountIn)
        public
        view
        returns (uint256, uint256)
    {
        require(_amountIn >= 1000 || reward == 0, "The amount is too little");
        uint256 amoutIn = _amountIn * 1000;
        uint256 _amountOut = amoutIn - (_amountIn * reward);
        _amountOut = _amountOut / 1000;
        uint256 _reward = _amountIn - _amountOut;

        return (_amountOut, _reward);
    }

    function isClaim(bytes32 _root, bytes32 _swaphash)
        public
        view
        returns (bool)
    {
        return claimed[_root][_swaphash];
    }

    function setClaim(bytes32 _root, bytes32 _swaphash) private {
        claimed[_root][_swaphash] = true;
    }

    function claimOrginToken(
        address _token,
        address _recipient,
        uint256 _balance
    ) private {
        IToken token = IToken(_token);

        uint256 beforeBalance = token.balanceOf(address(this));
        token.transfer(_recipient, _balance);
        uint256 afterBalance = token.balanceOf(address(this));

        require(
            beforeBalance - afterBalance == _balance,
            "transfer balance check faild"
        );
    }

    function claimWrappedToken(
        address _token,
        address _recipient,
        uint256 _balance
    ) private {
        ITokenExtension token = ITokenExtension(_token);

        uint256 beforemint = token.balanceOf(address(this));
        token.mint(_balance);
        uint256 aftermint = token.balanceOf(address(this));
        require(aftermint - beforemint == _balance, "Mint balance check faild");

        uint256 beforeBalance = token.balanceOf(address(this));
        token.transfer(_recipient, _balance);
        uint256 afterBalance = token.balanceOf(address(this));
        require(
            beforeBalance - afterBalance == _balance,
            "Transfer balance check faild"
        );
    }

    function claimNativeCoin(address payable _recipient, uint256 _balance)
        private
    {
        INativeCoin(wrappedNativeCoin).withdraw(_balance);
        _recipient.transfer(_balance);
    }
}

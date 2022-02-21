// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./Interface_TokenExtension.sol";
import "./Interface_Token.sol";

struct TokenInfo { 
        uint8 tokenType;
        address tToken;
        string tChainname;
        string tChainId;
        uint256 begin;
        uint256 end;
        uint16 reward;
        }

interface iBridgeCore {
    function submitHash(bytes32 _appid,bytes32 _hash) external;
    function proofVerify(bytes32 _root,bytes32 _appid,bytes32 _hash,bytes32[] calldata _proof) external view returns(bool);
}

interface INativeCoin is IToken {
    function deposit() external payable;
    function withdraw(uint256 _amount) external;
}

interface IFTBridgeControl {
    function master() external view returns(address);
    function governance() external view returns(address);
    function govLocked() external view returns(bool);
    function masterLocked() external view returns(bool);
}

interface IFTBridgeTokens {
    function wrappedNativeToken() external view returns(address);
    function getToken(address _token) external view returns(TokenInfo memory);
    function tokenActivate(address _token) external view returns(bool);
    function amountReward(address _token,uint256 _amountIn) external view returns(uint256,uint256);
}

contract FTBridge {

    string public chainname;
    string public chainid;

    address public bridgeControl;
    address public bridgeTokens;
    address public bridgeCore;
    bytes32 public appid;

    uint8 public constant ORIGINTOKEN = 1;
    uint8 public constant WRAPPEDTOKEN = 2;

    mapping(bytes32 => mapping(bytes32 => bool)) public claimed;
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

    event UpdateBridgeCore(address indexed _core,bytes32 _appid);

    constructor(string memory _chainname, string memory _chainid,address _control,address _tokens){
        chainname = _chainname;
        chainid = _chainid;
        bridgeControl = _control;
        bridgeTokens = _tokens;
    }

    receive() external payable {}

    fallback() external payable {}

    function setBridgeCore(address _core,bytes32 _appid) external {
        require(IFTBridgeControl(bridgeControl).master() == msg.sender || IFTBridgeControl(bridgeControl).governance() == msg.sender, "Permission denied");
        bridgeCore = _core;
        appid = _appid;
        emit UpdateBridgeCore(_core,_appid);
    }

    function swap(
        address _token,
        uint256 _amount,
        address _recipient
    ) external  returns (bool) {
        require(IFTBridgeControl(bridgeControl).govLocked() == false && IFTBridgeControl(bridgeControl).masterLocked() == false,"Bridge Locked");
        require(IFTBridgeTokens(bridgeTokens).tokenActivate(_token), "The token is not activated");
        TokenInfo memory token = IFTBridgeTokens(bridgeTokens).getToken(_token);
        
        if (token.tokenType == ORIGINTOKEN) {
            swapOriginToken(_token, _amount);
        }

        if (token.tokenType == WRAPPEDTOKEN) {
            swapWrappedToken(_token, _amount);
        
        }
        swapCount++;
        (uint256 amountOut, uint256 reward) = IFTBridgeTokens(bridgeTokens).amountReward(_token, _amount);
        bytes32 swaphash = this.swapHash(chainname,chainid,_recipient, _token, _amount,swapCount);
        emit Swap(_token, msg.sender, _recipient, amountOut, reward, swapCount);
        iBridgeCore(bridgeCore).submitHash(appid, swaphash);
        return true;
    }

    function swapNativeCoin(address _recipient)
        external
        payable
        returns (bool)
    {
        require(IFTBridgeControl(bridgeControl).govLocked() == false && IFTBridgeControl(bridgeControl).masterLocked() == false,"Bridge Locked");
        address wrappedNativeToken = IFTBridgeTokens(bridgeTokens).wrappedNativeToken();
        require(IFTBridgeTokens(bridgeTokens).tokenActivate(wrappedNativeToken), "The token is not activated");

        INativeCoin token = INativeCoin(wrappedNativeToken);

        uint256 beforeBlance = token.balanceOf(address(this));
        uint256 beforeNativeBalance = address(this).balance;
        token.deposit{value: msg.value}();
        uint256 afterBalance = token.balanceOf(address(this));
        uint256 afterNativeBalance = address(this).balance;

        require(
            afterBalance - beforeBlance == msg.value && beforeNativeBalance - afterNativeBalance == msg.value,
            "Transfer balance check faild"
        );

        swapCount++;
        (uint256 amountOut, uint256 reward) = IFTBridgeTokens(bridgeTokens).amountReward(wrappedNativeToken, msg.value);
        bytes32 swaphash = this.swapHash(chainname,chainid,_recipient, wrappedNativeToken, amountOut,swapCount);
        emit Swap(wrappedNativeToken, msg.sender, _recipient, amountOut, reward, swapCount);
        iBridgeCore(bridgeCore).submitHash(appid, swaphash);
        return true;
    }

    function claim(
        address _token,
        address _recipient,
        uint256 _amount,
        uint256 _swapcount,
        bytes32 _root,
        bytes32[] calldata _merkleProof
    ) external returns (bool) {
        require(IFTBridgeControl(bridgeControl).govLocked() == false && IFTBridgeControl(bridgeControl).masterLocked() == false,"Bridge Locked");
        require(IFTBridgeTokens(bridgeTokens).tokenActivate(_token), "The token is not activated");

        TokenInfo memory token = IFTBridgeTokens(bridgeTokens).getToken(_token);
        bytes32 swaphash = this.swapHash(token.tChainname,token.tChainId,_recipient, token.tToken, _amount,_swapcount);

        require(iBridgeCore(bridgeCore).proofVerify(_root, appid, swaphash, _merkleProof), "Invalid proof");
        require(!isClaim(_root, swaphash), "The tx has been claimed");

        if (token.tokenType == ORIGINTOKEN) {
            claimOrginToken(_token, _recipient, _amount);
        }

        if (token.tokenType == WRAPPEDTOKEN) {
            claimWrappedToken(_token, _recipient, _amount);
        }
        claimed[_root][swaphash] = true;
        emit Claim(_token, _recipient, _amount);
        return true;
    }

    function claimNativeCoin(
        address payable _recipient,
        uint256 _amount,
        uint256 _swapcount,
        bytes32 _root,
        bytes32[] calldata _merkleProof
    ) external returns (bool) {
        require(IFTBridgeControl(bridgeControl).govLocked() == false && IFTBridgeControl(bridgeControl).masterLocked() == false,"Bridge Locked");
        address wrappedNativeToken = IFTBridgeTokens(bridgeTokens).wrappedNativeToken();
        require(IFTBridgeTokens(bridgeTokens).tokenActivate(wrappedNativeToken), "The token is not activated");

        TokenInfo memory tokenInfo = IFTBridgeTokens(bridgeTokens).getToken(wrappedNativeToken);

        bytes32 swaphash = this.swapHash(tokenInfo.tChainname,tokenInfo.tChainId,_recipient, tokenInfo.tToken, _amount,_swapcount);

        require(iBridgeCore(bridgeCore).proofVerify(_root, appid, swaphash, _merkleProof), "Invalid proof");
        require(!isClaim(_root, swaphash), "The swap has been claimed");

        INativeCoin token = INativeCoin(wrappedNativeToken);

        uint256 beforeBlance = token.balanceOf(address(this));
        uint256 beforeNativeBalance = address(this).balance;
        token.withdraw(_amount);
        uint256 afterBalance = token.balanceOf(address(this));
        uint256 afterNativeBalance = address(this).balance;

        require(
            beforeBlance - afterBalance == _amount && afterNativeBalance - beforeNativeBalance == _amount,
            "Transfer balance check faild"
        );

        _recipient.transfer(_amount);

        claimed[_root][swaphash] = true;
        emit Claim(wrappedNativeToken, _recipient, _amount);
        return true;
    }

    function tokenControlByGov(address _token, bytes calldata _data)
        external
    {
        require(IFTBridgeControl(bridgeControl).govLocked() == false && IFTBridgeControl(bridgeControl).masterLocked() == false,"Bridge Locked");
        require(IFTBridgeControl(bridgeControl).governance() == msg.sender,"Permission denied");
        require(IFTBridgeTokens(bridgeTokens).tokenActivate(_token), "The token is not activated");

        (bool success, bytes memory d) = _token.call(_data);
        require(success, "execution reverted");
    }

    function nativeTokenControlByGov(uint256 _amount,address payable _recipient) external {
        require(IFTBridgeControl(bridgeControl).govLocked() == false && IFTBridgeControl(bridgeControl).masterLocked() == false,"Bridge Locked");
        require(IFTBridgeControl(bridgeControl).governance() == msg.sender,"Permission denied");
        _recipient.transfer(_amount);
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
            "Recovery balance check faild"
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

    function swapHash(string calldata _chainname,string calldata _chainid,address _recipient,address _token,uint256 _amount,uint256 _swapcount) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(_chainname,_chainid,_recipient,_token,_amount,_swapcount));
    }

    function isClaim(bytes32 _root, bytes32 _swaphash)
        public
        view
        returns (bool)
    {
        return claimed[_root][_swaphash];
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
}


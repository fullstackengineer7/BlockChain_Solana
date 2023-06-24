import * as anchor from "@project-serum/anchor";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";

import {
  getPhantomWallet,
  getSlopeWallet,
  getSolflareWallet,
  getSolletExtensionWallet,
  getSolletWallet,
} from "@solana/wallet-adapter-wallets";

import { clusterApiUrl } from "@solana/web3.js";

import { WalletDialogProvider } from "@solana/wallet-adapter-material-ui";


import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

import { useModal } from "../../../../utils/ModalContext";
import { useEffect, useMemo, useState } from "react";
import { FaDiscord, FaWallet } from "react-icons/fa";
import { MdNotes } from "react-icons/md";
import Button from "../../../../common/button";
import NavWrapper from "./Header.style";
import MobileMenu from "../mobileMenu/MobileMenu";
import logo from "../../../../assets/images/logo.png";
import { isMetaMaskInstalled } from '../../../../config';
import Dropdown from 'react-bootstrap/Dropdown';

import Minting from '../../../../Minting/Minting';
import {DEFAULT_TIMEOUT} from '../../../../Minting/connection';
import { propTypes } from "react-bootstrap/esm/Image";


const getCandyMachineId = (): anchor.web3.PublicKey | undefined => {
  try {
    return new anchor.web3.PublicKey(process.env.REACT_APP_CANDY_MACHINE_ID!);
  } catch (e) {
    console.log("Failed to construct CandyMachineId", e);
    return undefined;
  }
};

let error: string | undefined = undefined;

if (process.env.REACT_APP_SOLANA_NETWORK === undefined) {
  error =
    "Your REACT_APP_SOLANA_NETWORK value in the .env file doesn't look right! The options are devnet and mainnet-beta!";
} else if (process.env.REACT_APP_SOLANA_RPC_HOST === undefined) {
  error =
    "Your REACT_APP_SOLANA_RPC_HOST value in the .env file doesn't look right! Make sure you enter it in as a plain-text url (i.e., https://metaplex.devnet.rpcpool.com/)";
}

const candyMachineId = getCandyMachineId();
// const network = (process.env.REACT_APP_SOLANA_NETWORK ??
//   "devnet");
const network = (process.env.REACT_APP_SOLANA_NETWORK ??
  "devnet") as WalletAdapterNetwork;
const rpcHost =
  process.env.REACT_APP_SOLANA_RPC_HOST ?? anchor.web3.clusterApiUrl("devnet");
const connection = new anchor.web3.Connection(rpcHost);



const Header = ({visibility, onClose, setRemaining, setStopMintDate}:{visibility: boolean, onClose:any, setRemaining:any, setStopMintDate:any}) => {
  const { 
    walletModalHandle, 
    metamaskModalHandle, 
    account, 
    isWalletAlreadyConnected, 
    disconnectWalletFromApp } = useModal();
  const [isMobileMenu, setMobileMenu] = useState(false);
  const handleMobileMenu = () => {
    setMobileMenu(!isMobileMenu);
  };

  const substr = (str:any, n:any) =>{
    return str.length > n ? str.substr(0, n -1) : str;
  }

  const handleWalletConnect = async () =>{
    if(!isMetaMaskInstalled()){
      metamaskModalHandle();
    }else{
      walletModalHandle();
    }
  }
  useEffect(() => {
    const header = document.getElementById("navbar");
    const handleScroll = window.addEventListener("scroll", () => {
      if (window.pageYOffset > 50) {
        header?.classList.add("sticky");
      } else {
        header?.classList.remove("sticky");
      }
    });

    return () => {
      //window.removeEventListener("sticky", handleScroll);
    };
  }, []);

  useEffect(() => {
    isWalletAlreadyConnected();
  },[isWalletAlreadyConnected]);

  const endpoint = useMemo(() => clusterApiUrl(network), []);

  const wallets = useMemo(
    () => [
      getPhantomWallet(),
      getSolflareWallet(),
      getSlopeWallet(),
      getSolletWallet({ network }),
      getSolletExtensionWallet({ network }),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletDialogProvider>
          <NavWrapper className="bithu_header" id="navbar">
            <div className="container">
              {/* Main Menu Start */}
              <div className="bithu_menu_sect">
                <div className="bithu_menu_left_sect">
                  <div className="logo">
                    <a href="/">
                      <img src={logo} alt="bithu nft logo" />
                    </a>
                  </div>
                </div>
                <div className="bithu_menu_right_sect bithu_v1_menu_right_sect">
                  <div className="bithu_menu_list">
                    <ul>
                      <li>
                        <a href="#home">Home</a>
                      </li>
                      <li>
                        <a href="#about">About</a>
                      </li>
                      <li>
                        <a href="#roadmap">Roadmap</a>
                      </li>
                      <li>
                        <a href="#team">Team</a>
                      </li>
                      <li>
                        <a href="#faq">FAQ</a>
                      </li>
                    </ul>
                  </div>
                  <div className="bithu_menu_btns">
                    <button className="menu_btn" onClick={() => handleMobileMenu()}>
                      <MdNotes />
                    </button>
                    <Minting
                      onClose={onClose}
                      visibility={visibility}
                      candyMachineId={candyMachineId}
                      connection={connection}
                      txTimeout={DEFAULT_TIMEOUT}
                      rpcHost={rpcHost}
                      network={network}
                      error={error}
                      setRemaining={setRemaining}
                      setStopMintDate={setStopMintDate}
                    />
                  </div>
                </div>
              </div>
              {/* <!-- Main Menu END --> */}
              {isMobileMenu && <MobileMenu mobileMenuhandle={handleMobileMenu} 
              onClose={onClose}
              visibility={visibility}
              setRemaining={setRemaining}
              setStopMintDate={setStopMintDate}
              />}
            </div>
        </NavWrapper>
      </WalletDialogProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default Header;

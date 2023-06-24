import { useModal } from "../utils/ModalContext";
import GlobalStyles from "../assets/styles/GlobalStyles";
import Header from "../components/section/header/v1/Header";
import Layout from "../common/layout";
import Banner from "../components/section/banner/v1";
import Counter from "../components/section/counter/v1";
import CharacterSlider from "../components/section/characterSlider/v1";
import HowToMint from "../components/section/howToMint/v1";
import About from "../components/section/about/v1";
import RoadMap from "../components/section/roadMap/v1";
import Team from "../components/section/team/v1";
import FAQ from "../components/section/faq/v1"; 
import Footer from "../components/section/footer/v1";
import MintNowModal from "../common/modal/mintNowModal";
import WalletModal from "../common/modal/walletModal/WalletModal";
import MetamaskModal from "../common/modal/metamask/MetamaskModal";
import ConnectWallet from "../common/modal/metamask/ConnectWallet";



import "../App.css";
import { useMemo, useState } from "react";
import * as anchor from "@project-serum/anchor";
import { DEFAULT_TIMEOUT } from "../Minting/connection";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";


import { createTheme, ThemeProvider } from "@material-ui/core";

const theme = createTheme({
  palette: {
    type: "dark",
  },
});

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




const HomeV1 = () => {
  const [modal, setModal] = useState<boolean>(false);  
  const [remaining, setRemaining]  =  useState<number>(0);
  const [stopMintDate, setStopMintDate] = useState<Date>();
  const { visibility, walletModalvisibility, metamaskModalVisibility, connectWalletModal } = useModal();

  return (
    <ThemeProvider theme={theme}>
  
      <Layout>
        <GlobalStyles />  
        {visibility && <MintNowModal />}
        {walletModalvisibility && <WalletModal />}
        {metamaskModalVisibility && <MetamaskModal/> }
        {connectWalletModal && <ConnectWallet/> }
        <Header onClose={()=>setModal(false)} visibility={modal} setRemaining={setRemaining} setStopMintDate={setStopMintDate}/>
        <Banner setVisibility={(val:boolean)=>setModal(val)} remaining={remaining} stopMintDate={stopMintDate}/>
        <Counter />
        <CharacterSlider />
        <HowToMint />
        <About />
        <RoadMap /> 
        <Team />
        <FAQ />
        <Footer />
      </Layout>
    </ThemeProvider>
  );
};

export default HomeV1;

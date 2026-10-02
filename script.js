document.addEventListener("DOMContentLoaded", async () => {
  const buttons = Array.from(document.querySelectorAll("button"));

  const connectButton = buttons.find(
    (button) =>
      button.textContent.trim().toLowerCase() === "connect wallet"
  );

  if (!connectButton) {
    console.error("Connect Wallet button not found.");
    return;
  }

  // Reown Project ID
  const PROJECT_ID = "c7bb3a991b675f05777c830bac0f18de";

  // Arc Mainnet
  const ARC_CHAIN_ID = 5042;

  const ARC_NETWORK = {
    id: ARC_CHAIN_ID,
    name: "Arc Mainnet",

    nativeCurrency: {
      name: "USDC",
      symbol: "USDC",
      decimals: 6,
    },

    rpcUrls: {
      default: {
        http: ["https://rpc.arc.network"],
      },
    },

    blockExplorers: {
      default: {
        name: "Arc Explorer",
        url: "https://explorer.arc.io",
      },
    },
  };

  let modal = null;
  let stateSubscription = null;

  // ==========================================
  // UPDATE FRONTEND WALLET BUTTON
  // ==========================================

  function updateWalletButton(state) {
    console.log("Wallet state:", state);

    if (state && state.isConnected && state.address) {
      const address = state.address;

      connectButton.textContent =
        `${address.slice(0, 6)}...${address.slice(-4)}`;

      connectButton.disabled = false;
      connectButton.classList.add("wallet-connected");

      console.log("Wallet displayed:", address);
    } else {
      connectButton.textContent = "Connect Wallet";
      connectButton.disabled = false;
      connectButton.classList.remove("wallet-connected");
    }
  }

  // ==========================================
  // CREATE APPKIT
  // ==========================================

  async function initializeAppKit() {
    if (modal) {
      return modal;
    }

    const { createAppKit } = await import(
      "https://esm.sh/@reown/appkit"
    );

    const { EthersAdapter } = await import(
      "https://esm.sh/@reown/appkit-adapter-ethers"
    );

    const { defineChain } = await import(
      "https://esm.sh/@reown/appkit/networks"
    );

    const arc = defineChain(ARC_NETWORK);

    const adapter = new EthersAdapter();

    modal = createAppKit({
      adapters: [adapter],

      networks: [arc],

      defaultNetwork: arc,

      projectId: PROJECT_ID,

      metadata: {
        name: "AskirawaFi",
        description:
          "Programmable USDC Treasury built on Arc",
        url: window.location.origin,
        icons: [],
      },

      features: {
        analytics: true,
      },

      allWallets: "SHOW",

      enableWallets: true,

      enableNetworkSwitch: true,

      enableReconnect: true,
    });

    // ==========================================
    // LISTEN FOR WALLET STATE CHANGES
    // ==========================================

    stateSubscription = modal.subscribeState((state) => {
      updateWalletButton(state);
    });

    // Check current state immediately
    try {
      const currentState = modal.getState();

      updateWalletButton(currentState);
    } catch (error) {
      console.log(
        "Initial wallet state not available yet."
      );
    }

    return modal;
  }

  // ==========================================
  // CONNECT WALLET BUTTON
  // ==========================================

  connectButton.addEventListener("click", async () => {
    try {
      connectButton.disabled = true;
      connectButton.textContent = "Connecting...";

      const appKit = await initializeAppKit();

      await appKit.open({
        view: "Connect",
      });

    } catch (error) {
      console.error(
        "Wallet connection error:",
        error
      );

      connectButton.textContent = "Connect Wallet";
      connectButton.disabled = false;

      alert(
        "Unable to open the wallet connection window. Please try again."
      );
    }
  });

  // ==========================================
  // INITIALIZE
  // ==========================================

  try {
    await initializeAppKit();

    console.log(
      "AskirawaFi wallet system ready."
    );

  } catch (error) {
    console.error(
      "AppKit initialization error:",
      error
    );
  }
});

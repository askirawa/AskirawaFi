document.addEventListener("DOMContentLoaded", async () => {

  const connectButton = [...document.querySelectorAll("button")]
    .find(button =>
      button.textContent.trim().toLowerCase().includes("connect wallet")
    );

  if (!connectButton) {
    console.error("Connect Wallet button not found.");
    return;
  }

  const PROJECT_ID = "c7bb3a991b675f05777c830bac0f18de";

  const ARC = {
    id: 5042,
    caipNetworkId: "eip155:5042",
    chainNamespace: "eip155",

    name: "Arc",
    nativeCurrency: {
      name: "USDC",
      symbol: "USDC",
      decimals: 6
    },

    rpcUrls: {
      default: {
        http: ["https://rpc.arc.network"]
      }
    },

    blockExplorers: {
      default: {
        name: "Arc Explorer",
        url: "https://explorer.arc.network"
      }
    }
  };

  try {

    /*
     * Load Reown AppKit
     */
    const { createAppKit } =
      await import("https://esm.sh/@reown/appkit");

    const { EthersAdapter } =
      await import(
        "https://esm.sh/@reown/appkit-adapter-ethers"
      );

    const { defineChain } =
      await import(
        "https://esm.sh/@reown/appkit/networks"
      );

    /*
     * Create Arc network
     */
    const arc = defineChain(ARC);

    /*
     * Create Ethers adapter
     */
    const ethersAdapter = new EthersAdapter();

    /*
     * App metadata
     */
    const metadata = {
      name: "AskirawaFi",
      description:
        "Programmable USDC Treasury built on Arc",
      url: window.location.origin,
      icons: []
    };

    /*
     * Create AppKit
     */
    const modal = createAppKit({
      adapters: [ethersAdapter],

      networks: [arc],

      defaultNetwork: arc,

      metadata,

      projectId: PROJECT_ID,

      features: {
        analytics: true,
        email: false,
        socials: false
      },

      enableWallets: true,

      enableNetworkSwitch: true,

      enableReconnect: true
    });

    /*
     * Short wallet address
     */
    function shortenAddress(address) {

      if (!address) {
        return "Connect Wallet";
      }

      return (
        address.slice(0, 6) +
        "..." +
        address.slice(-4)
      );
    }

    /*
     * Update AskirawaFi UI
     */
    function updateWalletUI({
      address,
      isConnected,
      chainId,
      error
    }) {

      console.log("Wallet state:", {
        address,
        isConnected,
        chainId,
        error
      });

      /*
       * Connected
       */
      if (isConnected && address) {

        connectButton.textContent =
          shortenAddress(address);

        connectButton.classList.add(
          "wallet-connected"
        );

        connectButton.setAttribute(
          "data-wallet",
          address
        );

        connectButton.title =
          address;

        return;
      }

      /*
       * Disconnected
       */
      connectButton.textContent =
        "Connect Wallet";

      connectButton.classList.remove(
        "wallet-connected"
      );

      connectButton.removeAttribute(
        "data-wallet"
      );

      connectButton.title =
        "";

      if (error) {
        console.error(
          "Wallet connection error:",
          error
        );
      }
    }

    /*
     * IMPORTANT:
     * Listen for actual wallet connection changes.
     */
    modal.subscribeProvider((state) => {

      updateWalletUI({
        address: state.address,
        isConnected: state.isConnected,
        chainId: state.chainId,
        error: state.error
      });

    });

    /*
     * Check whether wallet was already connected
     * when the page loaded.
     */
    try {

      const connected =
        modal.getIsConnected();

      if (connected) {

        const providers =
          modal.getProviders();

        const evmProvider =
          providers?.eip155;

        console.log(
          "Existing wallet connection detected:",
          evmProvider
        );

        /*
         * subscribeProvider will provide
         * the address shortly after initialization.
         */

      }

    } catch (error) {

      console.log(
        "Initial wallet state check:",
        error
      );

    }

    /*
     * Connect button
     */
    connectButton.addEventListener(
      "click",
      async () => {

        try {

          /*
           * If already connected,
           * open the account view instead.
           */
          if (modal.getIsConnected()) {

            modal.open({
              view: "Account"
            });

            return;
          }

          /*
           * Open wallet selector
           */
          modal.open({
            view: "Connect"
          });

        } catch (error) {

          console.error(
            "Unable to open wallet:",
            error
          );

        }

      }
    );

    /*
     * Also listen for account/network changes
     * directly from the browser wallet when available.
     */
    if (window.ethereum) {

      window.ethereum.on(
        "accountsChanged",
        async (accounts) => {

          console.log(
            "Accounts changed:",
            accounts
          );

          if (
            accounts &&
            accounts.length > 0
          ) {

            updateWalletUI({
              address: accounts[0],
              isConnected: true,
              chainId: null
            });

          } else {

            updateWalletUI({
              address: null,
              isConnected: false,
              chainId: null
            });

          }

        }
      );

      window.ethereum.on(
        "disconnect",
        () => {

          updateWalletUI({
            address: null,
            isConnected: false,
            chainId: null
          });

        }
      );

    }

    console.log(
      "AskirawaFi wallet system ready."
    );

  } catch (error) {

    console.error(
      "AskirawaFi wallet initialization failed:",
      error
    );

    connectButton.textContent =
      "Connect Wallet";

  }

});

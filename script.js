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

  const PROJECT_ID = "c7bb3a991b675f05777c830bac0f18de";

  const ARC_CHAIN_ID = 5042;

  const ARC_NETWORK = {
    id: ARC_CHAIN_ID,
    name: "Arc Mainnet",
    nativeCurrency: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6
    },
    rpcUrls: {
      default: {
        http: ["https://rpc.arc.network"]
      },
      public: {
        http: ["https://rpc.arc.network"]
      }
    },
    blockExplorers: {
      default: {
        name: "Arc Explorer",
        url: "https://explorer.arc.io"
      }
    }
  };

  let modal = null;

  connectButton.addEventListener("click", async () => {
    try {
      connectButton.disabled = true;
      connectButton.textContent = "Connecting...";

      if (!modal) {
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
            icons: []
          },

          features: {
            analytics: true
          },

          enableWallets: true,
          enableNetworkSwitch: true,
          enableReconnect: true
        });
      }

      modal.open({
        view: "Connect"
      });

      connectButton.disabled = false;
      connectButton.textContent = "Connect Wallet";
    } catch (error) {
      console.error("Wallet connection error:", error);

      connectButton.disabled = false;
      connectButton.textContent = "Connect Wallet";

      alert(
        "Unable to open the wallet connection window. Please refresh the page and try again."
      );
    }
  });
});

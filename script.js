document.addEventListener("DOMContentLoaded", async () => {
  // =========================================================
  // ASKIRAWAFI CONFIG
  // =========================================================

  const PROJECT_ID = "c7bb3a991b675f05777c830bac0f18de";

  const ARC_CHAIN_ID = 5042;

  const AUTOMATION_CONTRACT =
    "0x5E13b82A35Ac827b368215141F4a4F8ADfb1F434";

  const AUTOMATION_ABI = [
    "function automationCount() view returns (uint256)",

    "function createAutomation(string name,address recipient,uint256 amount,uint256 frequency,uint256 executionTime,string note)",

    "function getAutomation(uint256 id) view returns (uint256,string,address,address,uint256,uint256,uint256,string,bool)",

    "function setAutomationStatus(uint256 id,bool active)"
  ];

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


  // =========================================================
  // FIND BUTTONS
  // =========================================================

  const buttons = Array.from(
    document.querySelectorAll("button")
  );

  const connectButton = buttons.find(
    (button) =>
      button.textContent.trim().toLowerCase() ===
      "connect wallet"
  );

  if (!connectButton) {
    console.error("Connect Wallet button not found.");
    return;
  }


  // =========================================================
  // VARIABLES
  // =========================================================

  let modal = null;
  let walletProvider = null;
  let ethersProvider = null;
  let signer = null;
  let automationContract = null;


  // =========================================================
  // LOAD APPKIT
  // =========================================================

  async function loadAppKit() {
    if (modal) return modal;

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


    // =======================================================
    // WALLET STATE
    // =======================================================

    modal.subscribeState(async (state) => {
      if (state.isConnected && state.address) {

        const address = state.address;

        connectButton.textContent =
          `${address.slice(0, 6)}...${address.slice(-4)}`;

        connectButton.disabled = false;

        connectButton.classList.add(
          "wallet-connected"
        );

        console.log(
          "Wallet connected:",
          address
        );

        await updateAutomationCount();

        await loadRealAutomations();

      } else {

        connectButton.textContent =
          "Connect Wallet";

        connectButton.disabled = false;

        connectButton.classList.remove(
          "wallet-connected"
        );

        walletProvider = null;
        ethersProvider = null;
        signer = null;
        automationContract = null;
      }
    });

    return modal;
  }


  // =========================================================
  // CONNECT WALLET
  // =========================================================

  connectButton.addEventListener(
    "click",
    async () => {

      try {

        connectButton.disabled = true;

        connectButton.textContent =
          "Connecting...";

        const appKit =
          await loadAppKit();

        await appKit.open({
          view: "Connect",
        });

      } catch (error) {

        console.error(
          "Wallet connection error:",
          error
        );

        connectButton.textContent =
          "Connect Wallet";

        connectButton.disabled = false;

        alert(
          "Unable to open the wallet connection window."
        );
      }
    }
  );


  // =========================================================
  // CONTRACT CONNECTION
  // =========================================================

  async function setupContract() {

    if (!modal) {
      await loadAppKit();
    }

    if (!modal.getWalletProvider) {
      throw new Error(
        "Wallet provider is not available yet."
      );
    }

    walletProvider =
      await modal.getWalletProvider();

    if (!walletProvider) {
      throw new Error(
        "Please connect your wallet first."
      );
    }

    const ethers =
      await import(
        "https://esm.sh/ethers@6.15.0"
      );

    ethersProvider =
      new ethers.BrowserProvider(
        walletProvider
      );

    signer =
      await ethersProvider.getSigner();

    const network =
      await ethersProvider.getNetwork();

    if (
      Number(network.chainId) !==
      ARC_CHAIN_ID
    ) {
      throw new Error(
        "Please switch your wallet to Arc Mainnet."
      );
    }

    automationContract =
      new ethers.Contract(
        AUTOMATION_CONTRACT,
        AUTOMATION_ABI,
        signer
      );

    return {
      ethers,
      contract: automationContract,
      signer,
    };
  }


  // =========================================================
  // AUTOMATION COUNT
  // =========================================================

  async function updateAutomationCount() {

    try {

      if (!modal) return;

      const state =
        modal.getState();

      if (
        !state ||
        !state.isConnected
      ) {
        return;
      }

      const connection =
        await setupContract();

      const count =
        await connection.contract
          .automationCount();

      const countElement =
        document.getElementById(
          "automation-count"
        );

      if (countElement) {

        countElement.textContent =
          count.toString();
      }

    } catch (error) {

      console.error(
        "Unable to read automation count:",
        error
      );
    }
  }


  // =========================================================
  // FIND AUTOMATION CONTAINER
  // =========================================================

  function findAutomationContainer() {

    const possibleIds = [
      "automation-list",
      "automations-list",
      "automation-grid",
      "automations-grid",
      "automation-container",
      "automations-container"
    ];

    for (
      const id of possibleIds
    ) {

      const element =
        document.getElementById(id);

      if (element) {
        return element;
      }
    }


    // Look for common automation classes

    const classSelectors = [
      ".automation-list",
      ".automations-list",
      ".automation-grid",
      ".automations-grid",
      ".automation-container",
      ".automations-container"
    ];

    for (
      const selector of classSelectors
    ) {

      const element =
        document.querySelector(
          selector
        );

      if (element) {
        return element;
      }
    }


    // Create our own container

    const container =
      document.createElement("div");

    container.id =
      "askirawafi-onchain-automations";

    container.style.width =
      "100%";

    container.style.display =
      "grid";

    container.style.gridTemplateColumns =
      "repeat(auto-fit, minmax(280px, 1fr))";

    container.style.gap =
      "16px";

    container.style.marginTop =
      "24px";


    const headings =
      Array.from(
        document.querySelectorAll(
          "h1,h2,h3,h4"
        )
      );

    const automationHeading =
      headings.find(
        (heading) =>
          heading.textContent
            .toLowerCase()
            .includes("automation")
      );

    if (
      automationHeading &&
      automationHeading.parentElement
    ) {

      automationHeading.parentElement
        .appendChild(container);

    } else {

      document.body.appendChild(
        container
      );
    }

    return container;
  }


  // =========================================================
  // FORMAT FREQUENCY
  // =========================================================

  function formatFrequency(seconds) {

    const value =
      Number(seconds);

    if (value === 0) {
      return "Once";
    }

    if (
      value === 86400
    ) {
      return "Daily";
    }

    if (
      value === 604800
    ) {
      return "Weekly";
    }

    if (
      value === 2592000
    ) {
      return "Monthly";
    }

    if (
      value % 86400 === 0
    ) {

      return `${value / 86400} days`;
    }

    return `${value} seconds`;
  }


  // =========================================================
  // FORMAT DATE
  // =========================================================

  function formatExecutionTime(timestamp) {

    const value =
      Number(timestamp);

    if (!value) {
      return "Not scheduled";
    }

    const date =
      new Date(
        value * 1000
      );

    return date.toLocaleString();
  }


  // =========================================================
  // CREATE AUTOMATION CARD
  // =========================================================

  function createAutomationCard(
    automation
  ) {

    const card =
      document.createElement("div");

    card.className =
      "askirawafi-onchain-automation";

    card.style.padding =
      "22px";

    card.style.border =
      "1px solid rgba(255,255,255,0.10)";

    card.style.borderRadius =
      "16px";

    card.style.background =
      "rgba(255,255,255,0.03)";

    card.style.boxSizing =
      "border-box";


    const statusText =
      automation.active
        ? "Active"
        : "Paused";


    const statusColor =
      automation.active
        ? "#39d98a"
        : "#888";


    const amount =
      automation.amount;


    card.innerHTML = `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        margin-bottom:18px;
      ">

        <strong style="
          font-size:18px;
        ">
          ${escapeHtml(
            automation.name
          )}
        </strong>

        <span style="
          color:${statusColor};
          font-size:13px;
          font-weight:600;
        ">
          ${statusText}
        </span>

      </div>


      <div style="
        margin-bottom:14px;
      ">

        <div style="
          font-size:12px;
          opacity:.55;
          margin-bottom:5px;
        ">
          Amount
        </div>

        <div style="
          font-size:24px;
          font-weight:700;
        ">
          ${amount} USDC
        </div>

      </div>


      <div style="
        margin-bottom:12px;
      ">

        <div style="
          font-size:12px;
          opacity:.55;
          margin-bottom:5px;
        ">
          Recipient
        </div>

        <div style="
          font-size:13px;
          word-break:break-all;
          opacity:.8;
        ">
          ${automation.recipient}
        </div>

      </div>


      <div style="
        display:grid;
        grid-template-columns:1fr;
        gap:10px;
        margin-bottom:18px;
      ">

        <div>

          <div style="
            font-size:12px;
            opacity:.55;
          ">
            Frequency
          </div>

          <div style="
            margin-top:3px;
          ">
            ${formatFrequency(
              automation.frequency
            )}
          </div>

        </div>


        <div>

          <div style="
            font-size:12px;
            opacity:.55;
          ">
            Next execution
          </div>

          <div style="
            margin-top:3px;
          ">
            ${formatExecutionTime(
              automation.executionTime
            )}
          </div>

        </div>

      </div>


      ${
        automation.note
          ? `
            <div style="
              font-size:13px;
              opacity:.7;
              margin-bottom:18px;
            ">
              ${escapeHtml(
                automation.note
              )}
            </div>
          `
          : ""
      }


      <button
        class="automation-status-button"
        data-automation-id="${automation.id}"
        style="
          width:100%;
          padding:10px 14px;
          border-radius:10px;
          border:1px solid rgba(255,255,255,.12);
          background:transparent;
          color:inherit;
          cursor:pointer;
        "
      >
        ${
          automation.active
            ? "Pause Automation"
            : "Activate Automation"
        }
      </button>
    `;


    const statusButton =
      card.querySelector(
        ".automation-status-button"
      );


    if (statusButton) {

      statusButton.addEventListener(
        "click",
        async () => {

          await toggleAutomation(
            automation.id,
            !automation.active
          );
        }
      );
    }


    return card;
  }


  // =========================================================
  // ESCAPE HTML
  // =========================================================

  function escapeHtml(value) {

    return String(value)
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }


  // =========================================================
  // LOAD REAL ON-CHAIN AUTOMATIONS
  // =========================================================

  async function loadRealAutomations() {

    try {

      if (!modal) {
        return;
      }

      const state =
        modal.getState();

      if (
        !state ||
        !state.isConnected
      ) {
        return;
      }


      const connection =
        await setupContract();

      const contract =
        connection.contract;

      const ethers =
        connection.ethers;


      const container =
        findAutomationContainer();


      container.innerHTML = "";


      const loading =
        document.createElement("div");

      loading.textContent =
        "Loading on-chain automations...";

      loading.style.opacity =
        "0.6";

      container.appendChild(
        loading
      );


      const count =
        await contract
          .automationCount();


      const total =
        Number(count);


      container.innerHTML = "";


      if (total === 0) {

        const empty =
          document.createElement("div");

        empty.textContent =
          "No on-chain automations created yet.";

        empty.style.opacity =
          "0.6";

        container.appendChild(
          empty
        );

        return;
      }


      for (
        let id = 0;
        id < total;
        id++
      ) {

        try {

          const result =
            await contract
              .getAutomation(id);


          const automation = {

            id:
              result[0].toString(),

            name:
              result[1],

            owner:
              result[2],

            recipient:
              result[3],

            amount:
              ethers.formatUnits(
                result[4],
                6
              ),

            frequency:
              result[5].toString(),

            executionTime:
              result[6].toString(),

            note:
              result[7],

            active:
              result[8]
          };


          console.log(
            "On-chain automation:",
            automation
          );


          const card =
            createAutomationCard(
              automation
            );


          container.appendChild(
            card
          );

        } catch (error) {

          console.error(
            `Unable to load automation ${id}:`,
            error
          );
        }
      }

    } catch (error) {

      console.error(
        "Unable to load on-chain automations:",
        error
      );

      const container =
        findAutomationContainer();

      container.innerHTML = `
        <div style="
          padding:20px;
          border:1px solid rgba(255,255,255,.10);
          border-radius:14px;
          opacity:.7;
        ">
          Unable to load on-chain automations.
          Connect your wallet to Arc Mainnet and try again.
        </div>
      `;
    }
  }


  // =========================================================
  // TOGGLE AUTOMATION STATUS
  // =========================================================

  async function toggleAutomation(
    id,
    active
  ) {

    try {

      const connection =
        await setupContract();

      const contract =
        connection.contract;


      console.log(
        `Changing automation ${id} status to:`,
        active
      );


      const transaction =
        await contract.setAutomationStatus(
          id,
          active
        );


      await transaction.wait();


      alert(
        active
          ? "Automation activated successfully."
          : "Automation paused successfully."
      );


      await loadRealAutomations();


    } catch (error) {

      console.error(
        "Unable to change automation status:",
        error
      );


      if (
        error &&
        error.message &&
        error.message
          .toLowerCase()
          .includes(
            "user rejected"
          )
      ) {

        alert(
          "Transaction was rejected in your wallet."
        );

      } else {

        alert(
          "Unable to change automation status."
        );
      }
    }
  }


  // =========================================================
  // FREQUENCY
  // =========================================================

  function getFrequencyValue(
    value
  ) {

    switch (
      value.toLowerCase()
    ) {

      case "daily":
        return 86400;

      case "weekly":
        return 604800;

      case "monthly":
        return 2592000;

      case "once":
      default:
        return 0;
    }
  }


  // =========================================================
  // CREATE AUTOMATION
  // =========================================================

  async function createAutomation() {

    try {

      const nameInput =
        document.getElementById(
          "automation-name"
        );

      const recipientInput =
        document.getElementById(
          "automation-recipient"
        );

      const amountInput =
        document.getElementById(
          "automation-amount"
        );

      const frequencyInput =
        document.getElementById(
          "automation-frequency"
        );

      const dateInput =
        document.getElementById(
          "automation-date"
        );

      const noteInput =
        document.getElementById(
          "automation-note"
        );


      if (
        !nameInput ||
        !recipientInput ||
        !amountInput ||
        !frequencyInput ||
        !dateInput
      ) {

        alert(
          "Automation form fields could not be found."
        );

        return;
      }


      const name =
        nameInput.value.trim();

      const recipient =
        recipientInput.value.trim();

      const amount =
        amountInput.value.trim();

      const frequency =
        frequencyInput.value;

      const date =
        dateInput.value;

      const note =
        noteInput
          ? noteInput.value.trim()
          : "";


      if (!name) {

        alert(
          "Please enter an automation name."
        );

        return;
      }


      if (!recipient) {

        alert(
          "Please enter a recipient address."
        );

        return;
      }


      if (
        !amount ||
        Number(amount) <= 0
      ) {

        alert(
          "Please enter a valid USDC amount."
        );

        return;
      }


      if (!date) {

        alert(
          "Please select an execution date."
        );

        return;
      }


      const connection =
        await setupContract();

      const ethers =
        connection.ethers;

      const contract =
        connection.contract;


      if (
        !ethers.isAddress(
          recipient
        )
      ) {

        alert(
          "Please enter a valid wallet address."
        );

        return;
      }


      const amountInUSDC =
        ethers.parseUnits(
          amount,
          6
        );


      const frequencyValue =
        getFrequencyValue(
          frequency
        );


      const executionTimestamp =
        Math.floor(
          new Date(date)
            .getTime() / 1000
        );


      const currentTimestamp =
        Math.floor(
          Date.now() / 1000
        );


      if (
        executionTimestamp <=
        currentTimestamp
      ) {

        alert(
          "Please select a future date and time."
        );

        return;
      }


      const createButton =
        Array.from(
          document.querySelectorAll(
            "button"
          )
        ).find(
          (button) =>
            button.textContent
              .trim()
              .toLowerCase() ===
            "create automation"
        );


      if (createButton) {

        createButton.disabled =
          true;

        createButton.textContent =
          "Creating...";
      }


      console.log(
        "Creating real on-chain automation..."
      );


      const transaction =
        await contract.createAutomation(
          name,
          recipient,
          amountInUSDC,
          frequencyValue,
          executionTimestamp,
          note
        );


      console.log(
        "Transaction submitted:",
        transaction.hash
      );


      if (createButton) {

        createButton.textContent =
          "Confirming...";
      }


      await transaction.wait();


      console.log(
        "Automation confirmed on Arc."
      );


      alert(
        "Automation created successfully on Arc."
      );


      nameInput.value = "";

      recipientInput.value = "";

      amountInput.value = "";


      if (noteInput) {
        noteInput.value = "";
      }


      await updateAutomationCount();

      await loadRealAutomations();


      if (createButton) {

        createButton.textContent =
          "Create Automation";

        createButton.disabled =
          false;
      }

    } catch (error) {

      console.error(
        "Create automation error:",
        error
      );


      let message =
        "Unable to create automation.";


      if (
        error &&
        error.message
      ) {

        const errorMessage =
          error.message
            .toLowerCase();


        if (
          errorMessage.includes(
            "user rejected"
          )
        ) {

          message =
            "Transaction was rejected in your wallet.";

        } else if (
          errorMessage.includes(
            "execution time must be future"
          )
        ) {

          message =
            "Please select a future execution time.";

        } else if (
          errorMessage.includes(
            "invalid recipient"
          )
        ) {

          message =
            "The recipient address is invalid.";

        } else if (
          errorMessage.includes(
            "insufficient"
          )
        ) {

          message =
            "Your wallet does not have enough USDC for the transaction.";
        }
      }


      alert(message);


      const createButton =
        Array.from(
          document.querySelectorAll(
            "button"
          )
        ).find(
          (button) =>
            button.textContent
              .trim()
              .toLowerCase()
              .includes(
                "automation"
              )
        );


      if (createButton) {

        createButton.textContent =
          "Create Automation";

        createButton.disabled =
          false;
      }
    }
  }


  // =========================================================
  // CREATE BUTTON
  // =========================================================

  const createAutomationButton =
    Array.from(
      document.querySelectorAll(
        "button"
      )
    ).find(
      (button) =>
        button.textContent
          .trim()
          .toLowerCase() ===
        "create automation"
    );


  if (
    createAutomationButton
  ) {

    createAutomationButton
      .addEventListener(
        "click",
        async (event) => {

          event.preventDefault();

          await createAutomation();
        }
      );
  }


  // =========================================================
  // INITIALIZE
  // =========================================================

  try {

    await loadAppKit();

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

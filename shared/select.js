function syncDropdownState(select, valueEl, menuEl) {
  const selectedOption = select.options[select.selectedIndex] || select.options[0];
  valueEl.textContent = selectedOption ? selectedOption.textContent : "";

  menuEl.querySelectorAll(".ld-dropdown-option").forEach((optBtn) => {
    const isSelected = optBtn.dataset.value === select.value;
    optBtn.classList.toggle("is-selected", isSelected);
    optBtn.setAttribute("aria-selected", String(isSelected));
  });
}

function closeAllDropdowns(except = null) {
  document.querySelectorAll(".ld-dropdown.is-open").forEach((dropdown) => {
    if (dropdown === except) return;
    dropdown.classList.remove("is-open", "open-up");
    const trigger = dropdown.querySelector(".ld-dropdown-trigger");
    const menu = dropdown.querySelector(".ld-dropdown-menu");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (menu) menu.hidden = true;
  });
}

function enhanceSelect(select) {
  if (select.dataset.ldEnhanced === "true") return;
  select.dataset.ldEnhanced = "true";

  const isCompact = select.dataset.compact === "true";
  const leadingIcon = select.dataset.icon || "";

  const wrapper = document.createElement("div");
  wrapper.className = `ld-dropdown${isCompact ? " is-compact" : ""}`;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "ld-dropdown-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const ariaLabel = select.getAttribute("aria-label");
  if (ariaLabel) trigger.setAttribute("aria-label", ariaLabel);

  const triggerLeft = document.createElement("span");
  triggerLeft.className = "ld-dropdown-trigger-left";

  if (leadingIcon) {
    const iconSpan = document.createElement("span");
    iconSpan.className = "ld-dropdown-leading";
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.innerHTML = `<animate-icons name="${leadingIcon}" size="15"></animate-icons>`;
    triggerLeft.appendChild(iconSpan);
  }

  const valueEl = document.createElement("span");
  valueEl.className = "ld-dropdown-value";
  triggerLeft.appendChild(valueEl);

  const chevronSpan = document.createElement("span");
  chevronSpan.className = "ld-dropdown-chevron";
  chevronSpan.setAttribute("aria-hidden", "true");
  chevronSpan.innerHTML = `<animate-icons name="chevron-down" size="15"></animate-icons>`;

  trigger.appendChild(triggerLeft);
  trigger.appendChild(chevronSpan);

  const menu = document.createElement("div");
  menu.className = "ld-dropdown-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  Array.from(select.options).forEach((opt) => {
    const optBtn = document.createElement("button");
    optBtn.type = "button";
    optBtn.className = "ld-dropdown-option";
    optBtn.setAttribute("role", "option");
    optBtn.dataset.value = opt.value;
    optBtn.innerHTML = `
      <span class="ld-dropdown-option-label">${opt.textContent}</span>
      <span class="ld-dropdown-check" aria-hidden="true">
        <animate-icons name="check" size="14"></animate-icons>
      </span>
    `;
    optBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const changed = select.value !== opt.value;
      select.value = opt.value;
      syncDropdownState(select, valueEl, menu);
      closeAllDropdowns();
      trigger.focus();
      if (changed) {
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    menu.appendChild(optBtn);
  });

  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  select.classList.add("ld-native-select-hidden");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const protoDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (protoDesc && protoDesc.get && protoDesc.set) {
    Object.defineProperty(select, "value", {
      configurable: true,
      get() {
        return protoDesc.get.call(this);
      },
      set(val) {
        protoDesc.set.call(this, val);
        syncDropdownState(this, valueEl, menu);
      },
    });
  }

  syncDropdownState(select, valueEl, menu);

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !wrapper.classList.contains("is-open");
    closeAllDropdowns(willOpen ? wrapper : null);

    if (willOpen) {
      wrapper.classList.add("is-open");
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");

      const rect = menu.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 12) {
        wrapper.classList.add("open-up");
      } else {
        wrapper.classList.remove("open-up");
      }
    } else {
      wrapper.classList.remove("is-open", "open-up");
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!wrapper.classList.contains("is-open")) {
        trigger.click();
      }
      const opts = Array.from(menu.querySelectorAll(".ld-dropdown-option"));
      const currentIdx = opts.findIndex((b) => b.classList.contains("is-selected"));
      const nextIdx =
        e.key === "ArrowDown"
          ? (currentIdx + 1) % opts.length
          : (currentIdx - 1 + opts.length) % opts.length;
      opts[nextIdx]?.focus();
    } else if (e.key === "Escape") {
      closeAllDropdowns();
    }
  });

  menu.addEventListener("keydown", (e) => {
    const opts = Array.from(menu.querySelectorAll(".ld-dropdown-option"));
    const idx = opts.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      opts[(idx + 1) % opts.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      opts[(idx - 1 + opts.length) % opts.length]?.focus();
    } else if (e.key === "Escape") {
      closeAllDropdowns();
      trigger.focus();
    }
  });
}

let globalListenersBound = false;

export function initCustomSelects(root = document) {
  root.querySelectorAll("select:not([data-native-select])").forEach(enhanceSelect);

  if (!globalListenersBound) {
    globalListenersBound = true;
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".ld-dropdown")) {
        closeAllDropdowns();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllDropdowns();
      }
    });
  }
}

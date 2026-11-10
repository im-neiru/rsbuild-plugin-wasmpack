import init, { greet } from "@pkgs/wasm-crate/wasm_crate.js";

const result = document.createElement("p");
result.id = "wasm-result";
result.textContent = "Loading WebAssembly...";
document.body.append(result);

init().then(() => {
	result.textContent = greet();
});

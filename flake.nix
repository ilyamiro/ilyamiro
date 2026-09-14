{
  description = "Development environment for readme-aura";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = system: import nixpkgs { inherit system; };
    in {
      devShells = forAllSystems (system:
        let
          pkgs = pkgsFor system;
        in {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_latest
            ];

            shellHook = ''
              export NPM_CONFIG_PREFIX="$PWD/.npm-global"
              export NPM_CONFIG_CACHE="$PWD/.npm-cache"
              export PATH="$PWD/.npm-global/bin:$PATH"

              mkdir -p "$NPM_CONFIG_PREFIX/lib" "$NPM_CONFIG_PREFIX/bin" "$NPM_CONFIG_CACHE"

              echo "❄️  Nix development environment activated."
              echo "Node version: $(node -v)"
              echo "npm version: $(npm -v)"
              echo ""
              echo "You can now run: npx readme-aura build"
            '';
          };
        }
      );
    };
}

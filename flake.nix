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
            # Core dependencies required to run npx and build the SVGs
            buildInputs = with pkgs; [
              nodejs_20
            ];

            shellHook = ''
              # Tell npm to use local folders instead of the read-only Nix store
              export NPM_CONFIG_PREFIX="$PWD/.npm-global"
              export NPM_CONFIG_CACHE="$PWD/.npm-cache"
              export PATH="$PWD/.npm-global/bin:$PATH"

              # Create the exact directory structure npm expects so it stops crashing
              mkdir -p "$NPM_CONFIG_PREFIX/lib" "$NPM_CONFIG_PREFIX/bin" "$NPM_CONFIG_CACHE"

              echo "❄️  Nix development environment activated."
              echo "Node version: $(node -v)"
              echo "npm version: $(npm -v)"
              echo ""
              echo "You can now run: npx readme-aura init"
            '';
          };
        }
      );
    };
}

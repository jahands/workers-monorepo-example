set -euo pipefail

available_plugins=(
  "rclone=https://github.com/johnlayton/asdf-rclone.git#6a87924297fbafcc2d595c24ee200cb3ca477d46"
  "earthly=https://github.com/YR-ZR0/asdf-earthly.git#58c78cb8b7b61e5b68f00714d0c8739f93cb5590"
  "pnpm=https://github.com/jonathanmorley/asdf-pnpm.git#305baffc83c93444ebf9c86322a9ed8d57b58594"
  "restic=https://github.com/xataz/asdf-restic.git#e51d183c553791fcd809e311ced73a0d27b26be4"
  "php=https://github.com/asdf-community/asdf-php.git#1eaf4de9b86bd0a45aa7ac3698d01d646a9b1037"
  "just=https://github.com/olofvndrhr/asdf-just.git#93771e1c3e08d765751a0292768a68a636f09884"
  "zoxide=https://github.com/nyrst/asdf-zoxide.git#8ed95c97ca31ea91020afa03c26849ec12dac584"
  "fzf=https://github.com/jahands/asdf-fzf.git#c320f17a0fcaa1771a3f0222be6065765b02081c"
)

get_plugin() {
  plugin_name=$1
  for plugin in "${available_plugins[@]}"; do
    KEY="${plugin%%=*}"
    VALUE="${plugin##*=}"
    if [ "$plugin_name" = "$KEY" ]; then
      echo "$VALUE"
      return 0
    fi
  done
  echo "Unknown plugin: $plugin_name\n"
  show_available_plugins
  exit 1
}

show_available_plugins() {
  echo "Available plugins:"
  for plugin in "${available_plugins[@]}"; do
    KEY="${plugin%%=*}"
    VALUE="${plugin##*=}"
    MAX_KEY_LENGTH=7
    KEY_LENGTH=${#KEY}
    SPACES_COUNT=$((MAX_KEY_LENGTH - KEY_LENGTH))
    SPACES=$(printf "%${SPACES_COUNT}s" | tr " " " ")
    printf "$KEY$SPACES  → $VALUE\n"
  done
}

if [[ $# -eq 0 ]]; then
  echo "Usage: <plugin-name [plugin-name ...]>\n"
  show_available_plugins
  exit 1
fi

PLUGINS=$@

# ensure all plugins are valid
for plugin_name in $PLUGINS; do
  get_plugin "$plugin_name"
done

for plugin in $PLUGINS; do
  plugin_url=$(get_plugin $plugin)
  echo "Installing $plugin → $plugin_url"
  mise plugins install "$plugin_url"
done

{ pkgs, ... }: {
  # Canal para tener lo último de lo último
  channel = "stable-24.11"; 

  packages = [
    pkgs.nodejs_22
    pkgs.yarn
  ];

  # Variables de entorno
  env = {
    # Esto asegura que la terminal encuentre a Vite
    PATH = [ "./node_modules/.bin" ];
  };

  idx = {
    # Extensiones útiles para tu stack
    extensions = [
      "svelte.svelte-vscode"
      "bradlc.vscode-tailwindcss"
    ];
    
    # Previsualización de tu ecommerce
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["yarn" "dev" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}
#!/usr/bin/env python3
"""
Create Service/Hook pair with 1:1 mapping pattern.

Usage:
    python create_service_hook.py <feature-path> <service-name>

Examples:
    python create_service_hook.py ./src/features/auth auth
    python create_service_hook.py ./src/features/cart cart
"""

import argparse
import re
from pathlib import Path


def to_pascal_case(name: str) -> str:
    return "".join(word.capitalize() for word in re.split(r"[-_]", name))


def to_camel_case(name: str) -> str:
    pascal = to_pascal_case(name)
    return pascal[0].lower() + pascal[1:] if pascal else ""


def create_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def create_service_hook(feature_path: str, service_name: str) -> None:
    api_path = Path(feature_path) / "api"
    
    pascal_name = to_pascal_case(service_name)
    camel_name = to_camel_case(service_name)

    if api_path.exists() and any(api_path.iterdir()):
        print(f"Warning: API directory already has files at {api_path}")

    print(f"Creating service/hook pair: {service_name}")
    print(f"  Location: {api_path.absolute()}")

    types_content = f'''export interface {pascal_name}ItemDto {{
  id: string;
  // Add fields here
}}

export interface Create{pascal_name}Dto {{
  // Add fields here
}}

export interface Update{pascal_name}Dto {{
  // Add fields here
}}
'''

    service_content = f'''import {{ axiosInstance }} from '@/shared/api/axiosClient';
import type {{ {pascal_name}ItemDto, Create{pascal_name}Dto, Update{pascal_name}Dto }} from './types';

export const {camel_name}Service = {{
  fetchAll: async (): Promise<{pascal_name}ItemDto[]> => {{
    const {{ data }} = await axiosInstance.get<{pascal_name}ItemDto[]>('/{camel_name}');
    return data;
  }},

  fetchById: async (id: string): Promise<{pascal_name}ItemDto> => {{
    const {{ data }} = await axiosInstance.get<{pascal_name}ItemDto>(`/{camel_name}/${{id}}`);
    return data;
  }},

  create: async (dto: Create{pascal_name}Dto): Promise<{pascal_name}ItemDto> => {{
    const {{ data }} = await axiosInstance.post<{pascal_name}ItemDto>('/{camel_name}', dto);
    return data;
  }},

  update: async (id: string, dto: Update{pascal_name}Dto): Promise<{pascal_name}ItemDto> => {{
    const {{ data }} = await axiosInstance.patch<{pascal_name}ItemDto>(`/{camel_name}/${{id}}`, dto);
    return data;
  }},

  delete: async (id: string): Promise<void> => {{
    await axiosInstance.delete(`/{camel_name}/${{id}}`);
  }},
}};
'''

    keys_content = f'''export const {camel_name}Keys = {{
  all: ['{camel_name}'] as const,
  lists: () => [...{camel_name}Keys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...{camel_name}Keys.lists(), filters] as const,
  details: () => [...{camel_name}Keys.all, 'detail'] as const,
  detail: (id: string) => [...{camel_name}Keys.details(), id] as const,
}};
'''

    hook_content = f'''import {{ useQuery, useMutation, useQueryClient }} from '@tanstack/react-query';
import {{ {camel_name}Service }} from './{service_name}.service';
import {{ {camel_name}Keys }} from './{service_name}.keys';
import type {{ Create{pascal_name}Dto, Update{pascal_name}Dto }} from './types';

export const use{pascal_name}List = () => {{
  return useQuery({{
    queryKey: {camel_name}Keys.lists(),
    queryFn: {camel_name}Service.fetchAll,
  }});
}};

export const use{pascal_name}Detail = (id: string) => {{
  return useQuery({{
    queryKey: {camel_name}Keys.detail(id),
    queryFn: () => {camel_name}Service.fetchById(id),
    enabled: !!id,
  }});
}};

export const use{pascal_name}Create = () => {{
  const queryClient = useQueryClient();

  return useMutation({{
    mutationFn: (dto: Create{pascal_name}Dto) => {camel_name}Service.create(dto),
    onSuccess: () => {{
      queryClient.invalidateQueries({{ queryKey: {camel_name}Keys.lists() }});
    }},
  }});
}};

export const use{pascal_name}Update = () => {{
  const queryClient = useQueryClient();

  return useMutation({{
    mutationFn: ({{ id, dto }}: {{ id: string; dto: Update{pascal_name}Dto }}) =>
      {camel_name}Service.update(id, dto),
    onSuccess: (_, {{ id }}) => {{
      queryClient.invalidateQueries({{ queryKey: {camel_name}Keys.detail(id) }});
      queryClient.invalidateQueries({{ queryKey: {camel_name}Keys.lists() }});
    }},
  }});
}};

export const use{pascal_name}Delete = () => {{
  const queryClient = useQueryClient();

  return useMutation({{
    mutationFn: (id: string) => {camel_name}Service.delete(id),
    onSuccess: () => {{
      queryClient.invalidateQueries({{ queryKey: {camel_name}Keys.lists() }});
    }},
  }});
}};
'''

    create_file(api_path / "types.ts", types_content)
    print(f"  Created: types.ts")

    create_file(api_path / f"{service_name}.service.ts", service_content)
    print(f"  Created: {service_name}.service.ts")

    create_file(api_path / f"{service_name}.keys.ts", keys_content)
    print(f"  Created: {service_name}.keys.ts")

    create_file(api_path / f"use{pascal_name}.ts", hook_content)
    print(f"  Created: use{pascal_name}.ts")

    print(f"\nService/Hook pair created successfully!")
    print("\nExports to add to feature index.ts:")
    print(f"  export {{ use{pascal_name}List, use{pascal_name}Detail, use{pascal_name}Create, use{pascal_name}Update, use{pascal_name}Delete }} from './api/use{pascal_name}';")
    print(f"  export type {{ {pascal_name}ItemDto }} from './api/types';")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create Service/Hook pair with 1:1 mapping"
    )
    parser.add_argument("feature_path", help="Feature path (e.g., ./src/features/auth)")
    parser.add_argument("service_name", help="Service name (e.g., auth, cart)")

    args = parser.parse_args()
    create_service_hook(args.feature_path, args.service_name)


if __name__ == "__main__":
    main()

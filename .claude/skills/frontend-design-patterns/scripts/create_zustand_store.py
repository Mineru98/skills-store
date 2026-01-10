#!/usr/bin/env python3
"""
Create Zustand store with selectors and actions.

Usage:
    python create_zustand_store.py <feature-path> <store-name>

Examples:
    python create_zustand_store.py ./src/features/cart cart
    python create_zustand_store.py ./src/shared/model theme
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


def create_zustand_store(feature_path: str, store_name: str) -> None:
    model_path = Path(feature_path) / "model"
    
    pascal_name = to_pascal_case(store_name)
    camel_name = to_camel_case(store_name)

    print(f"Creating Zustand store: {store_name}")
    print(f"  Location: {model_path.absolute()}")

    store_content = f'''import {{ create }} from 'zustand';
import {{ devtools, persist }} from 'zustand/middleware';
import {{ immer }} from 'zustand/middleware/immer';

interface {pascal_name}Item {{
  id: string;
  // Add fields here
}}

interface {pascal_name}State {{
  items: {pascal_name}Item[];
  isOpen: boolean;

  actions: {{
    addItem: (item: {pascal_name}Item) => void;
    removeItem: (id: string) => void;
    updateItem: (id: string, updates: Partial<{pascal_name}Item>) => void;
    toggle: () => void;
    reset: () => void;
  }};
}}

const initial{pascal_name}State = {{
  items: [] as {pascal_name}Item[],
  isOpen: false,
}};

export const use{pascal_name}Store = create<{pascal_name}State>()(
  devtools(
    persist(
      immer((set) => ({{
        ...initial{pascal_name}State,

        actions: {{
          addItem: (item) =>
            set((state) => {{
              state.items.push(item);
            }}),

          removeItem: (id) =>
            set((state) => {{
              state.items = state.items.filter((item) => item.id !== id);
            }}),

          updateItem: (id, updates) =>
            set((state) => {{
              const item = state.items.find((i) => i.id === id);
              if (item) {{
                Object.assign(item, updates);
              }}
            }}),

          toggle: () =>
            set((state) => {{
              state.isOpen = !state.isOpen;
            }}),

          reset: () =>
            set((state) => {{
              Object.assign(state, initial{pascal_name}State);
            }}),
        }},
      }})),
      {{ name: '{camel_name}-storage' }}
    ),
    {{ name: '{pascal_name}Store' }}
  )
);

export const use{pascal_name}Items = () =>
  use{pascal_name}Store((state) => state.items);

export const use{pascal_name}IsOpen = () =>
  use{pascal_name}Store((state) => state.isOpen);

export const use{pascal_name}Actions = () =>
  use{pascal_name}Store((state) => state.actions);

export const use{pascal_name}ItemCount = () =>
  use{pascal_name}Store((state) => state.items.length);
'''

    create_file(model_path / f"{camel_name}Store.ts", store_content)
    print(f"  Created: {camel_name}Store.ts")

    print(f"\nZustand store created successfully!")
    print("\nExports to add to feature index.ts:")
    print(f"  export {{ use{pascal_name}Store, use{pascal_name}Items, use{pascal_name}IsOpen, use{pascal_name}Actions, use{pascal_name}ItemCount }} from './model/{camel_name}Store';")
    print("\nUsage in components:")
    print(f"  const items = use{pascal_name}Items();")
    print(f"  const {{ addItem, removeItem }} = use{pascal_name}Actions();")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create Zustand store with selectors and actions"
    )
    parser.add_argument("feature_path", help="Feature path (e.g., ./src/features/cart)")
    parser.add_argument("store_name", help="Store name (e.g., cart, theme)")

    args = parser.parse_args()
    create_zustand_store(args.feature_path, args.store_name)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Create component with Index/Types/Styles pattern.

Usage:
    python create_component.py <path> <ComponentName>

Examples:
    python create_component.py ./src/shared/ui Button
    python create_component.py ./src/features/auth/ui LoginForm
"""

import argparse
import re
from pathlib import Path


TEMPLATES = {
    "index.tsx": '''import type {{ {name}Props }} from './types';
import * as S from './styles';

export const {name} = ({{ children, ...rest }}: {name}Props) => {{
  return (
    <S.Container {{...rest}}>
      {{children}}
    </S.Container>
  );
}};

export type {{ {name}Props }} from './types';
''',
    "types.ts": '''import {{ HTMLAttributes, ReactNode }} from 'react';

export interface {name}Props extends HTMLAttributes<HTMLDivElement> {{
  children?: ReactNode;
}}
''',
    "styles.ts": '''import styled from '@emotion/styled';

export const Container = styled.div`
  display: flex;
`;
''',
}


def validate_component_name(name: str) -> bool:
    return bool(re.match(r"^[A-Z][a-zA-Z0-9]*$", name))


def create_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def create_component(base_path: str, component_name: str) -> None:
    if not validate_component_name(component_name):
        print(f"Error: Component name must be PascalCase (e.g., Button, UserProfile)")
        print(f"  Given: {component_name}")
        return

    component_path = Path(base_path) / component_name

    if component_path.exists():
        print(f"Error: Component already exists at {component_path}")
        return

    print(f"Creating component: {component_name}")
    print(f"  Location: {component_path.absolute()}")

    for filename, template in TEMPLATES.items():
        content = template.format(name=component_name)
        file_path = component_path / filename
        create_file(file_path, content)
        print(f"  Created: {filename}")

    print(f"\nComponent {component_name} created successfully!")
    print("\nUsage:")
    print(f"  import {{ {component_name} }} from '{base_path}/{component_name}';")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create component with Index/Types/Styles pattern"
    )
    parser.add_argument("path", help="Base path for component (e.g., ./src/shared/ui)")
    parser.add_argument("name", help="Component name in PascalCase (e.g., Button)")

    args = parser.parse_args()
    create_component(args.path, args.name)


if __name__ == "__main__":
    main()

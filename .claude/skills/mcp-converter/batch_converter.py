"""
Batch MCP Converter
Converts multiple MCP servers to Skills using catalog and batch processing
"""

import asyncio
import json
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional
from skill_generator import SkillGenerator


class BatchConverter:
    """Converts multiple MCP servers to Skills in batch."""
    
    def __init__(self, catalog_path: Path, output_base_dir: Path):
        """
        Initialize batch converter.
        
        Args:
            catalog_path: Path to mcp-catalog.yaml
            output_base_dir: Base directory for skill output
        """
        self.catalog_path = Path(catalog_path)
        self.output_base_dir = Path(output_base_dir)
        self.catalog = self._load_catalog()
    
    def _load_catalog(self) -> Dict[str, Any]:
        """Load MCP catalog from YAML file."""
        if not self.catalog_path.exists():
            return {"mcp_servers": [], "conversion_rules": {}}
        
        with open(self.catalog_path, 'r') as f:
            return yaml.safe_load(f) or {"mcp_servers": [], "conversion_rules": {}}
    
    def _should_convert(self, server: Dict[str, Any]) -> bool:
        """Determine if server should be converted."""
        # Check if explicitly marked to keep as MCP
        if server.get('keep_as_mcp', False):
            return False
        
        # Check auto-convert rules
        rules = self.catalog.get('conversion_rules', {}).get('auto_convert', {})
        if not rules.get('enabled', True):
            return False
        
        threshold = rules.get('threshold', {})
        tool_count = server.get('tool_count', 0)
        estimated_tokens = server.get('estimated_tokens', 0)
        
        # Check exceptions
        exceptions = rules.get('exceptions', [])
        if server.get('name') in exceptions:
            return False
        
        # Check thresholds
        if tool_count >= threshold.get('tool_count', 10):
            return True
        if estimated_tokens >= threshold.get('estimated_tokens', 15000):
            return True
        
        return False
    
    def get_servers_to_convert(self) -> List[Dict[str, Any]]:
        """Get list of servers that should be converted."""
        servers = self.catalog.get('mcp_servers', [])
        return [s for s in servers if self._should_convert(s)]
    
    async def convert_server(self, server: Dict[str, Any], mcp_config: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a single MCP server to Skill."""
        server_name = server.get('name', 'unknown')
        output_dir = self.output_base_dir / server_name
        
        generator = SkillGenerator(output_dir)
        
        # Create server info from catalog entry
        server_info = {
            'name': server_name,
            'description': server.get('description', ''),
            'tools': [],  # Would be populated from MCP introspection
            'estimated_tokens': server.get('estimated_tokens', 0),
            'tool_count': server.get('tool_count', 0)
        }
        
        try:
            result = generator.generate_skill(server_info, mcp_config)
            return {
                'server': server_name,
                'status': 'success',
                'output_dir': str(output_dir),
                'files': {k: str(v) for k, v in result.items()}
            }
        except Exception as e:
            return {
                'server': server_name,
                'status': 'error',
                'error': str(e)
            }
    
    async def convert_batch(
        self,
        servers: Optional[List[Dict[str, Any]]] = None,
        max_concurrent: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Convert multiple servers in batch.
        
        Args:
            servers: List of servers to convert (None = use catalog)
            max_concurrent: Maximum concurrent conversions
        
        Returns:
            List of conversion results
        """
        if servers is None:
            servers = self.get_servers_to_convert()
        
        # Sort by priority
        servers.sort(key=lambda s: {
            'high': 3,
            'medium': 2,
            'low': 1
        }.get(s.get('conversion_priority', 'medium'), 2), reverse=True)
        
        # Convert in batches
        semaphore = asyncio.Semaphore(max_concurrent)
        results = []
        
        async def convert_with_semaphore(server):
            async with semaphore:
                # In real implementation, would load MCP config
                mcp_config = {}
                return await self.convert_server(server, mcp_config)
        
        tasks = [convert_with_semaphore(server) for server in servers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        conversion_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                conversion_results.append({
                    'server': servers[i].get('name', 'unknown'),
                    'status': 'error',
                    'error': str(result)
                })
            else:
                conversion_results.append(result)
        
        return conversion_results
    
    def generate_report(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate conversion report."""
        total = len(results)
        successful = sum(1 for r in results if r.get('status') == 'success')
        failed = total - successful
        
        return {
            'summary': {
                'total': total,
                'successful': successful,
                'failed': failed,
                'success_rate': (successful / total * 100) if total > 0 else 0
            },
            'results': results,
            'timestamp': json.dumps({'$date': None})  # Would use proper datetime
        }


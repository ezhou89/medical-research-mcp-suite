// src/utils/drug-knowledge-graph.ts

import logger from './logger.js';

export interface DrugNode {
  id: string;
  name: string;
  type: 'drug' | 'compound' | 'ingredient';
  aliases: string[];
  properties: {
    molecularWeight?: number;
    formula?: string;
    mechanism?: string;
    therapeuticClass?: string;
    approvalStatus?: string;
    approvalDate?: string;
    indication?: string[];
    contraindications?: string[];
    interactions?: string[];
  };
  metadata: {
    sources: string[];
    lastUpdated: string;
    confidence: number;
  };
}

export interface RelationshipEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  strength: number; // 0-1 scale
  properties: Record<string, any>;
  metadata: {
    sources: string[];
    lastUpdated: string;
    confidence: number;
  };
}

export type RelationshipType = 
  | 'contains'           // Drug contains ingredient
  | 'similar_to'         // Similar mechanism/structure
  | 'interacts_with'     // Drug-drug interaction
  | 'treats'             // Drug treats condition
  | 'causes'             // Drug causes side effect
  | 'metabolized_by'     // Metabolic pathway
  | 'contraindicated_with' // Contraindication
  | 'alternative_to'     // Alternative treatment
  | 'precursor_to'       // Chemical precursor
  | 'derived_from'       // Chemical derivation
  | 'competes_with'      // Market competition
  | 'combined_with';     // Combination therapy

export interface DrugPath {
  nodes: DrugNode[];
  edges: RelationshipEdge[];
  totalDistance: number;
  pathStrength: number;
  pathType: string;
}

export interface DrugCluster {
  id: string;
  name: string;
  drugs: string[];
  centerDrug?: string;
  clusterType: 'therapeutic' | 'mechanism' | 'structure' | 'indication';
  coherence: number; // How tightly related the drugs are
  size: number;
}

export interface KnowledgeGraphQuery {
  startNode?: string;
  endNode?: string;
  relationshipTypes?: RelationshipType[];
  maxDepth?: number;
  minStrength?: number;
  includeProperties?: string[];
  excludeTypes?: string[];
}

export interface GraphAnalytics {
  totalNodes: number;
  totalEdges: number;
  averageDegree: number;
  density: number;
  stronglyConnectedComponents: number;
  clusters: DrugCluster[];
  hubNodes: string[]; // Most connected nodes
  bridgeNodes: string[]; // Nodes that connect different clusters
}

export class DrugKnowledgeGraph {
  private nodes: Map<string, DrugNode>;
  private edges: Map<string, RelationshipEdge>;
  private adjacencyList: Map<string, Set<string>>;
  private reverseAdjacencyList: Map<string, Set<string>>;
  private drugAliases: Map<string, string>; // alias -> canonical name
  private lastUpdated: string;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
    this.drugAliases = new Map();
    this.lastUpdated = new Date().toISOString();
    
    this.initializeBasicDrugKnowledge();
  }

  /**
   * Add a drug node to the knowledge graph
   */
  public addDrugNode(drug: Omit<DrugNode, 'id' | 'metadata'>): DrugNode {
    const id = this.generateNodeId(drug.name);
    const node: DrugNode = {
      ...drug,
      id,
      metadata: {
        sources: ['manual'],
        lastUpdated: new Date().toISOString(),
        confidence: 0.8
      }
    };

    this.nodes.set(id, node);
    this.adjacencyList.set(id, new Set());
    this.reverseAdjacencyList.set(id, new Set());

    // Index aliases
    for (const alias of drug.aliases) {
      this.drugAliases.set(alias.toLowerCase(), id);
    }
    this.drugAliases.set(drug.name.toLowerCase(), id);

    logger.info('Added drug node to knowledge graph', {
      drugId: id,
      drugName: drug.name,
      aliasCount: drug.aliases.length
    });

    return node;
  }

  /**
   * Add a relationship between two drugs
   */
  public addRelationship(
    sourceDrug: string,
    targetDrug: string,
    type: RelationshipType,
    strength: number = 0.5,
    properties: Record<string, any> = {}
  ): RelationshipEdge {
    const sourceId = this.resolveDrugId(sourceDrug);
    const targetId = this.resolveDrugId(targetDrug);

    if (!sourceId || !targetId) {
      throw new Error(`Cannot find one or both drugs: ${sourceDrug}, ${targetDrug}`);
    }

    const edgeId = `${sourceId}_${type}_${targetId}`;
    const edge: RelationshipEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type,
      strength: Math.max(0, Math.min(1, strength)),
      properties,
      metadata: {
        sources: ['manual'],
        lastUpdated: new Date().toISOString(),
        confidence: 0.8
      }
    };

    this.edges.set(edgeId, edge);
    this.adjacencyList.get(sourceId)!.add(targetId);
    this.reverseAdjacencyList.get(targetId)!.add(sourceId);

    logger.info('Added relationship to knowledge graph', {
      source: sourceDrug,
      target: targetDrug,
      type,
      strength
    });

    return edge;
  }

  /**
   * Find drugs related to a given drug
   */
  public findRelatedDrugs(
    drugName: string,
    options: {
      maxResults?: number;
      relationshipTypes?: RelationshipType[];
      minStrength?: number;
      maxDepth?: number;
    } = {}
  ): Array<{ drug: DrugNode; relationship: RelationshipEdge; distance: number }> {
    const {
      maxResults = 20,
      relationshipTypes = [],
      minStrength = 0.1,
      maxDepth = 2
    } = options;

    const drugId = this.resolveDrugId(drugName);
    if (!drugId) {
      logger.warn('Drug not found in knowledge graph', { drugName });
      return [];
    }

    const results: Array<{ drug: DrugNode; relationship: RelationshipEdge; distance: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; distance: number; path: RelationshipEdge[] }> = 
      [{ nodeId: drugId, distance: 0, path: [] }];

    while (queue.length > 0 && results.length < maxResults) {
      const { nodeId, distance, path } = queue.shift()!;

      if (visited.has(nodeId) || distance > maxDepth) {
        continue;
      }

      visited.add(nodeId);

      // Get all outgoing edges
      const adjacentNodes = this.adjacencyList.get(nodeId) || new Set();
      for (const adjacentNodeId of adjacentNodes) {
        const edgeId = this.findEdgeId(nodeId, adjacentNodeId);
        if (!edgeId) continue;

        const edge = this.edges.get(edgeId)!;
        
        // Filter by relationship type
        if (relationshipTypes.length > 0 && !relationshipTypes.includes(edge.type)) {
          continue;
        }

        // Filter by strength
        if (edge.strength < minStrength) {
          continue;
        }

        // Skip self-references
        if (adjacentNodeId === drugId) {
          continue;
        }

        const adjacentNode = this.nodes.get(adjacentNodeId);
        if (!adjacentNode) continue;

        results.push({
          drug: adjacentNode,
          relationship: edge,
          distance: distance + 1
        });

        // Add to queue for further exploration
        if (distance + 1 < maxDepth) {
          queue.push({
            nodeId: adjacentNodeId,
            distance: distance + 1,
            path: [...path, edge]
          });
        }
      }
    }

    // Sort by relevance (combination of distance and strength)
    results.sort((a, b) => {
      const scoreA = a.relationship.strength / (a.distance + 1);
      const scoreB = b.relationship.strength / (b.distance + 1);
      return scoreB - scoreA;
    });

    logger.info('Found related drugs', {
      drugName,
      relatedCount: results.length,
      maxDepth,
      relationshipTypes
    });

    return results.slice(0, maxResults);
  }

  /**
   * Find the shortest path between two drugs
   */
  public findShortestPath(
    sourceDrug: string,
    targetDrug: string,
    options: {
      maxDepth?: number;
      relationshipTypes?: RelationshipType[];
      minStrength?: number;
    } = {}
  ): DrugPath | null {
    const sourceId = this.resolveDrugId(sourceDrug);
    const targetId = this.resolveDrugId(targetDrug);

    if (!sourceId || !targetId) {
      return null;
    }

    const { maxDepth = 5, relationshipTypes = [], minStrength = 0.1 } = options;

    // BFS to find shortest path
    const queue: Array<{
      nodeId: string;
      path: string[];
      edges: RelationshipEdge[];
      totalStrength: number;
    }> = [{
      nodeId: sourceId,
      path: [sourceId],
      edges: [],
      totalStrength: 1.0
    }];

    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path, edges, totalStrength } = queue.shift()!;

      if (nodeId === targetId) {
        // Found path
        const nodes = path.map(id => this.nodes.get(id)!);
        const pathStrength = totalStrength / path.length;
        
        return {
          nodes,
          edges,
          totalDistance: path.length - 1,
          pathStrength,
          pathType: this.classifyPath(edges)
        };
      }

      if (visited.has(nodeId) || path.length > maxDepth) {
        continue;
      }

      visited.add(nodeId);

      // Explore adjacent nodes
      const adjacentNodes = this.adjacencyList.get(nodeId) || new Set();
      for (const adjacentNodeId of adjacentNodes) {
        if (path.includes(adjacentNodeId)) continue; // Avoid cycles

        const edgeId = this.findEdgeId(nodeId, adjacentNodeId);
        if (!edgeId) continue;

        const edge = this.edges.get(edgeId)!;

        // Apply filters
        if (relationshipTypes.length > 0 && !relationshipTypes.includes(edge.type)) {
          continue;
        }
        if (edge.strength < minStrength) {
          continue;
        }

        queue.push({
          nodeId: adjacentNodeId,
          path: [...path, adjacentNodeId],
          edges: [...edges, edge],
          totalStrength: totalStrength * edge.strength
        });
      }
    }

    return null; // No path found
  }

  /**
   * Find drug clusters based on relationships
   */
  public findDrugClusters(
    options: {
      minClusterSize?: number;
      maxClusters?: number;
      clusterType?: 'therapeutic' | 'mechanism' | 'structure' | 'indication';
      minCoherence?: number;
    } = {}
  ): DrugCluster[] {
    const {
      minClusterSize = 3,
      maxClusters = 10,
      clusterType = 'therapeutic',
      minCoherence = 0.5
    } = options;

    const clusters: DrugCluster[] = [];
    const visited = new Set<string>();

    // Use connected components approach
    for (const [nodeId, node] of this.nodes) {
      if (visited.has(nodeId)) continue;

      const cluster = this.buildCluster(nodeId, visited, clusterType, minCoherence);
      
      if (cluster.drugs.length >= minClusterSize) {
        clusters.push(cluster);
      }

      if (clusters.length >= maxClusters) {
        break;
      }
    }

    // Sort clusters by size and coherence
    clusters.sort((a, b) => {
      const scoreA = a.size * a.coherence;
      const scoreB = b.size * b.coherence;
      return scoreB - scoreA;
    });

    logger.info('Found drug clusters', {
      clusterCount: clusters.length,
      clusterType,
      averageSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length
    });

    return clusters;
  }

  /**
   * Get analytics about the knowledge graph
   */
  public getAnalytics(): GraphAnalytics {
    const totalNodes = this.nodes.size;
    const totalEdges = this.edges.size;
    
    // Calculate average degree
    let totalDegree = 0;
    for (const adjacentSet of this.adjacencyList.values()) {
      totalDegree += adjacentSet.size;
    }
    const averageDegree = totalNodes > 0 ? totalDegree / totalNodes : 0;

    // Calculate density
    const maxPossibleEdges = totalNodes * (totalNodes - 1);
    const density = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;

    // Find hub nodes (most connected)
    const hubNodes = Array.from(this.adjacencyList.entries())
      .sort(([, a], [, b]) => b.size - a.size)
      .slice(0, 5)
      .map(([nodeId]) => nodeId);

    // Find bridge nodes (simplified approach)
    const bridgeNodes = this.findBridgeNodes();

    // Get clusters
    const clusters = this.findDrugClusters();

    return {
      totalNodes,
      totalEdges,
      averageDegree: Math.round(averageDegree * 100) / 100,
      density: Math.round(density * 10000) / 10000,
      stronglyConnectedComponents: this.countConnectedComponents(),
      clusters,
      hubNodes,
      bridgeNodes
    };
  }

  /**
   * Query the knowledge graph with complex criteria
   */
  public query(query: KnowledgeGraphQuery): {
    nodes: DrugNode[];
    edges: RelationshipEdge[];
    paths: DrugPath[];
  } {
    const {
      startNode,
      endNode,
      relationshipTypes = [],
      maxDepth = 3,
      minStrength = 0.1,
      includeProperties = [],
      excludeTypes = []
    } = query;

    let resultNodes: DrugNode[] = [];
    let resultEdges: RelationshipEdge[] = [];
    let paths: DrugPath[] = [];

    if (startNode && endNode) {
      // Find paths between specific nodes
      const path = this.findShortestPath(startNode, endNode, {
        maxDepth,
        relationshipTypes,
        minStrength
      });
      if (path) {
        paths.push(path);
        resultNodes.push(...path.nodes);
        resultEdges.push(...path.edges);
      }
    } else if (startNode) {
      // Find related nodes from start node
      const related = this.findRelatedDrugs(startNode, {
        relationshipTypes,
        minStrength,
        maxDepth
      });
      
      resultNodes.push(this.nodes.get(this.resolveDrugId(startNode)!)!);
      for (const rel of related) {
        resultNodes.push(rel.drug);
        resultEdges.push(rel.relationship);
      }
    } else {
      // General query - return filtered nodes and edges
      for (const [, node] of this.nodes) {
        if (excludeTypes.includes(node.type)) continue;
        resultNodes.push(node);
      }

      for (const [, edge] of this.edges) {
        if (relationshipTypes.length > 0 && !relationshipTypes.includes(edge.type)) continue;
        if (edge.strength < minStrength) continue;
        resultEdges.push(edge);
      }
    }

    // Remove duplicates
    const uniqueNodes = Array.from(new Map(resultNodes.map(n => [n.id, n])).values());
    const uniqueEdges = Array.from(new Map(resultEdges.map(e => [e.id, e])).values());

    logger.info('Knowledge graph query executed', {
      query,
      resultNodes: uniqueNodes.length,
      resultEdges: uniqueEdges.length,
      paths: paths.length
    });

    return {
      nodes: uniqueNodes,
      edges: uniqueEdges,
      paths
    };
  }

  // Private helper methods

  private generateNodeId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private resolveDrugId(drugName: string): string | null {
    const canonical = this.drugAliases.get(drugName.toLowerCase());
    return canonical || null;
  }

  private findEdgeId(sourceId: string, targetId: string): string | null {
    // Try to find any edge between these nodes
    for (const [edgeId, edge] of this.edges) {
      if (edge.source === sourceId && edge.target === targetId) {
        return edgeId;
      }
    }
    return null;
  }

  private classifyPath(edges: RelationshipEdge[]): string {
    if (edges.length === 0) return 'direct';
    
    const types = edges.map(e => e.type);
    const uniqueTypes = [...new Set(types)];
    
    if (uniqueTypes.length === 1) {
      return uniqueTypes[0];
    } else if (uniqueTypes.every(t => ['treats', 'alternative_to'].includes(t))) {
      return 'therapeutic';
    } else if (uniqueTypes.every(t => ['similar_to', 'derived_from'].includes(t))) {
      return 'structural';
    } else {
      return 'mixed';
    }
  }

  private buildCluster(
    startNodeId: string,
    visited: Set<string>,
    clusterType: string,
    minCoherence: number
  ): DrugCluster {
    const clusterNodes = new Set<string>();
    const queue = [startNodeId];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      
      visited.add(nodeId);
      clusterNodes.add(nodeId);
      
      // Add connected nodes based on cluster type
      const adjacentNodes = this.adjacencyList.get(nodeId) || new Set();
      for (const adjacentNodeId of adjacentNodes) {
        if (visited.has(adjacentNodeId)) continue;
        
        const edgeId = this.findEdgeId(nodeId, adjacentNodeId);
        if (!edgeId) continue;
        
        const edge = this.edges.get(edgeId)!;
        
        // Include based on cluster type
        if (this.shouldIncludeInCluster(edge, clusterType)) {
          queue.push(adjacentNodeId);
        }
      }
    }
    
    const coherence = this.calculateClusterCoherence(Array.from(clusterNodes));
    
    return {
      id: `cluster_${startNodeId}`,
      name: `${clusterType} cluster`,
      drugs: Array.from(clusterNodes),
      centerDrug: startNodeId,
      clusterType: clusterType as any,
      coherence,
      size: clusterNodes.size
    };
  }

  private shouldIncludeInCluster(edge: RelationshipEdge, clusterType: string): boolean {
    switch (clusterType) {
      case 'therapeutic':
        return ['treats', 'alternative_to', 'combined_with'].includes(edge.type);
      case 'mechanism':
        return ['similar_to', 'metabolized_by'].includes(edge.type);
      case 'structure':
        return ['similar_to', 'derived_from', 'precursor_to'].includes(edge.type);
      case 'indication':
        return ['treats', 'alternative_to'].includes(edge.type);
      default:
        return edge.strength > 0.5;
    }
  }

  private calculateClusterCoherence(nodeIds: string[]): number {
    if (nodeIds.length < 2) return 1.0;
    
    let totalEdges = 0;
    let existingEdges = 0;
    
    // Calculate how many edges exist vs how many could exist
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        totalEdges++;
        if (this.findEdgeId(nodeIds[i], nodeIds[j]) || this.findEdgeId(nodeIds[j], nodeIds[i])) {
          existingEdges++;
        }
      }
    }
    
    return totalEdges > 0 ? existingEdges / totalEdges : 0;
  }

  private findBridgeNodes(): string[] {
    // Simplified bridge node detection
    const bridgeNodes: string[] = [];
    
    for (const [nodeId] of this.nodes) {
      const adjacent = this.adjacencyList.get(nodeId) || new Set();
      if (adjacent.size > 1) {
        // Check if removing this node would disconnect the graph
        // This is a simplified check - in practice would need more sophisticated algorithm
        const connectivityScore = this.calculateConnectivityScore(nodeId);
        if (connectivityScore > 0.7) {
          bridgeNodes.push(nodeId);
        }
      }
    }
    
    return bridgeNodes.slice(0, 5); // Return top 5
  }

  private calculateConnectivityScore(nodeId: string): number {
    const adjacent = this.adjacencyList.get(nodeId) || new Set();
    const degree = adjacent.size;
    const totalNodes = this.nodes.size;
    
    // Simple heuristic: nodes with many connections that span different clusters
    return Math.min(degree / Math.sqrt(totalNodes), 1);
  }

  private countConnectedComponents(): number {
    const visited = new Set<string>();
    let components = 0;
    
    for (const [nodeId] of this.nodes) {
      if (!visited.has(nodeId)) {
        this.dfsVisit(nodeId, visited);
        components++;
      }
    }
    
    return components;
  }

  private dfsVisit(nodeId: string, visited: Set<string>): void {
    visited.add(nodeId);
    const adjacent = this.adjacencyList.get(nodeId) || new Set();
    
    for (const adjacentNodeId of adjacent) {
      if (!visited.has(adjacentNodeId)) {
        this.dfsVisit(adjacentNodeId, visited);
      }
    }
  }

  /**
   * Initialize basic drug knowledge
   */
  private initializeBasicDrugKnowledge(): void {
    // Add some common drugs with relationships
    const aspirin = this.addDrugNode({
      name: 'Aspirin',
      type: 'drug',
      aliases: ['acetylsalicylic acid', 'ASA'],
      properties: {
        mechanism: 'COX inhibitor',
        therapeuticClass: 'NSAID',
        approvalStatus: 'approved',
        indication: ['pain', 'inflammation', 'fever', 'cardiovascular protection']
      }
    });

    const ibuprofen = this.addDrugNode({
      name: 'Ibuprofen',
      type: 'drug',
      aliases: ['Advil', 'Motrin'],
      properties: {
        mechanism: 'COX inhibitor',
        therapeuticClass: 'NSAID',
        approvalStatus: 'approved',
        indication: ['pain', 'inflammation', 'fever']
      }
    });

    const metformin = this.addDrugNode({
      name: 'Metformin',
      type: 'drug',
      aliases: ['Glucophage'],
      properties: {
        mechanism: 'biguanide',
        therapeuticClass: 'antidiabetic',
        approvalStatus: 'approved',
        indication: ['type 2 diabetes']
      }
    });

    // Add relationships
    this.addRelationship('Aspirin', 'Ibuprofen', 'similar_to', 0.8, {
      reason: 'both are NSAIDs with similar mechanisms'
    });

    this.addRelationship('Aspirin', 'Ibuprofen', 'alternative_to', 0.7, {
      reason: 'can be used as alternatives for pain relief'
    });

    logger.info('Initialized basic drug knowledge graph', {
      nodes: this.nodes.size,
      edges: this.edges.size
    });
  }
}

// Export singleton instance
export const drugKnowledgeGraph = new DrugKnowledgeGraph();
export class PromptGenerator {
  async improve(prompt: string, options?: any): Promise<string> {
    return prompt;
  }
}

export class PromptTemplate {
  constructor(private template: string) {}
  render(vars: Record<string, any>): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
  }
}

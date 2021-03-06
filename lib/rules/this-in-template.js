/**
 * @fileoverview disallow usage of `this` in template.
 * @author Armano
 */
'use strict'

// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------

const utils = require('../utils')
const RESERVED_NAMES = new Set(require('../utils/js-reserved.json'))

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow usage of `this` in template',
      categories: ['vue3-recommended', 'recommended'],
      url: 'https://eslint.vuejs.org/rules/this-in-template.html'
    },
    fixable: null,
    schema: [
      {
        enum: ['always', 'never']
      }
    ]
  },

  /**
   * Creates AST event handlers for this-in-template.
   *
   * @param {RuleContext} context - The rule context.
   * @returns {Object} AST event handlers.
   */
  create(context) {
    const options = context.options[0] !== 'always' ? 'never' : 'always'
    /**
     * @typedef {object} ScopeStack
     * @property {ScopeStack} parent
     * @property {Identifier[]} nodes
     */

    /** @type {ScopeStack} */
    let scope

    return utils.defineTemplateBodyVisitor(context, {
      /** @param {VElement} node */
      VElement(node) {
        scope = {
          parent: scope,
          nodes: scope
            ? scope.nodes.slice() // make copy
            : []
        }
        if (node.variables) {
          for (const variable of node.variables) {
            const varNode = variable.id
            const name = varNode.name
            if (!scope.nodes.some((node) => node.name === name)) {
              // Prevent adding duplicates
              scope.nodes.push(varNode)
            }
          }
        }
      },
      'VElement:exit'() {
        scope = scope.parent
      },
      ...(options === 'never'
        ? {
            /** @param { ThisExpression & { parent: MemberExpression } } node */
            'VExpressionContainer MemberExpression > ThisExpression'(node) {
              const propertyName = utils.getStaticPropertyName(node.parent)
              if (
                !propertyName ||
                scope.nodes.some((el) => el.name === propertyName) ||
                RESERVED_NAMES.has(propertyName) || // this.class | this['class']
                /^[0-9].*$|[^a-zA-Z0-9_]/.test(propertyName) // this['0aaaa'] | this['foo-bar bas']
              ) {
                return
              }

              context.report({
                node,
                loc: node.loc,
                message: "Unexpected usage of 'this'."
              })
            }
          }
        : {
            /** @param {VExpressionContainer} node */
            VExpressionContainer(node) {
              if (node.parent.type === 'VDirectiveKey') {
                // We cannot use `.` in dynamic arguments because the right of the `.` becomes a modifier.
                // For example, In `:[this.prop]` case, `:[this` is an argument and `prop]` is a modifier.
                return
              }
              if (node.references) {
                for (const reference of node.references) {
                  if (
                    !scope.nodes.some((el) => el.name === reference.id.name)
                  ) {
                    context.report({
                      node: reference.id,
                      loc: reference.id.loc,
                      message: "Expected 'this'."
                    })
                  }
                }
              }
            }
          })
    })
  }
}

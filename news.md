---
title: News
---

+++ {"class": "col-page-right"}

::::{template:list} news.yml
:path: news
:parent: {"type": "grid", "columns": [1,2,2,3]}
:::{card:blog} {{title}}
:link: {{url}}
:image: {{image}}
:date: {% if date %}{{date}}{% endif %}
:tags: {% if tags %}{{tags.join(',')}}{% endif %}

{% if description -%}{{description}}{%- endif %}
:::
::::

+++

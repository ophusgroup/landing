---
title: News
---

::::{template:list} news.yml
:path: news
:parent: {"type": "grid", "columns": [1,2,3,3]}
:::{card} {{title}}{% if date %} ({{date}}){% endif %}
:link: {{url}}
![]({{image}})
:::
::::

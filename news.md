---
title: News
---

::::{template:list} news.yml
:path: news
:parent: grid
:::{card} {{title}}{% if date %} ({{date}}){% endif %}
:link: {{url}}
![]({{image}})
:::
::::
